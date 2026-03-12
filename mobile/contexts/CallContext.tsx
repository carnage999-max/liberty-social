import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { apiClient } from '../utils/api';
import { User } from '../types';
import { storage } from '../utils/storage';
import { getWsBase } from '../constants/API';

let WebRTC: any = null;
let InCallManager: any = null;

try {
  WebRTC = require('react-native-webrtc');
} catch (error) {
  // WebRTC is not available in Expo Go.
}

try {
  InCallManager = require('react-native-incall-manager');
} catch (error) {
  // InCallManager may be unavailable in unsupported builds.
}

const getFallbackIceServers = () => {
  const stunServers = (process.env.EXPO_PUBLIC_WEBRTC_STUN_URLS || 'stun:stun.l.google.com:19302')
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);

  const turnUrl = process.env.EXPO_PUBLIC_WEBRTC_TURN_URL?.trim();
  const turnUsername = process.env.EXPO_PUBLIC_WEBRTC_TURN_USERNAME?.trim();
  const turnCredential = process.env.EXPO_PUBLIC_WEBRTC_TURN_CREDENTIAL?.trim();

  const servers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [];

  if (stunServers.length) {
    servers.push({ urls: stunServers });
  }

  if (turnUrl && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
};

interface Call {
  id: number;
  caller: User;
  receiver: User;
  call_type: 'voice' | 'video';
  status: 'initiating' | 'ringing' | 'active' | 'ended' | 'missed' | 'rejected' | 'cancelled';
  conversation: number;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
}

interface CallContextType {
  incomingCall: Call | null;
  activeCall: Call | null;
  outgoingCall: Call | null;
  initiateCall: (receiverId: number, callType: 'voice' | 'video', conversationId?: number) => Promise<void>;
  answerCall: (callId: number) => Promise<void>;
  rejectCall: (callId: number) => Promise<void>;
  endCall: () => Promise<void>;
  setIncomingCall: (call: Call | null) => void;
  setActiveCall: (call: Call | null) => void;
  setOutgoingCall: (call: Call | null) => void;

}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<Call | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const incomingPollRef = useRef<NodeJS.Timeout | null>(null);
  const outgoingPollRef = useRef<NodeJS.Timeout | null>(null);
  const incomingStatusPollRef = useRef<NodeJS.Timeout | null>(null);
  const incomingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activePollRef = useRef<NodeJS.Timeout | null>(null);
  const endRetryTimeoutsRef = useRef<Record<number, NodeJS.Timeout>>({});
  const peerConnectionRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const pendingOffersRef = useRef<Record<string, any>>({});
  const pendingIceCandidatesRef = useRef<Record<string, any[]>>({});
  const pendingSocketEventsRef = useRef<Array<Record<string, any>>>([]);
  const iceServersCacheRef = useRef<Array<{ urls: string | string[]; username?: string; credential?: string }> | null>(null);
  const iceServersFetchedAtRef = useRef<number>(0);

  const isWebRTCEnabled = !!WebRTC?.RTCPeerConnection && !!WebRTC?.mediaDevices;

  useEffect(() => {
    console.log('[CallContext] WebRTC available:', isWebRTCEnabled);
  }, [isWebRTCEnabled]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearCallTimeout = useCallback(() => {
    if (callTimerRef.current) {
      clearTimeout(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const clearIncomingTimeout = useCallback(() => {
    if (incomingTimeoutRef.current) {
      clearTimeout(incomingTimeoutRef.current);
      incomingTimeoutRef.current = null;
    }
  }, []);

  const clearEndRetry = useCallback((callId: number) => {
    const timeout = endRetryTimeoutsRef.current[callId];
    if (timeout) {
      clearTimeout(timeout);
      delete endRetryTimeoutsRef.current[callId];
    }
  }, []);

  const persistCallEndWithRetry = useCallback(async (callId: number, durationSeconds: number, attempt = 0) => {
    try {
      await apiClient.post(`/calls/${callId}/end/`, {
        duration_seconds: durationSeconds,
      });
      clearEndRetry(callId);
    } catch (error) {
      if (attempt >= 5) {
        clearEndRetry(callId);
        return;
      }
      const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
      clearEndRetry(callId);
      endRetryTimeoutsRef.current[callId] = setTimeout(() => {
        persistCallEndWithRetry(callId, durationSeconds, attempt + 1);
      }, delay);
    }
  }, [clearEndRetry]);

  const sendSocketEvent = useCallback((payload: Record<string, any>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const flushPendingSocketEvents = useCallback(() => {
    if (!pendingSocketEventsRef.current.length) return;
    const pending = [...pendingSocketEventsRef.current];
    pendingSocketEventsRef.current = [];
    pending.forEach((payload) => {
      const sent = sendSocketEvent(payload);
      if (!sent) {
        pendingSocketEventsRef.current.push(payload);
      }
    });
  }, [sendSocketEvent]);

  const emitSocketEvent = useCallback((payload: Record<string, any>) => {
    const sent = sendSocketEvent(payload);
    if (!sent) {
      pendingSocketEventsRef.current.push(payload);
    }
    return sent;
  }, [sendSocketEvent]);

  const stopAudioSession = useCallback(() => {
    if (!InCallManager) return;
    try {
      InCallManager.stopRingtone?.();
      InCallManager.stop?.();
    } catch (error) {
      // Best effort.
    }
  }, []);

  const startAudioSession = useCallback((callType: 'voice' | 'video') => {
    if (!InCallManager) return;
    try {
      InCallManager.start?.({ media: callType === 'video' ? 'video' : 'audio' });
      // Force speaker on for mobile social calls so audio is clearly audible.
      const shouldUseSpeaker = true;
      InCallManager.setSpeakerphoneOn?.(shouldUseSpeaker);
      InCallManager.setForceSpeakerphoneOn?.(shouldUseSpeaker);
    } catch (error) {
      // Best effort.
    }
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.close();
      } catch (error) {
        // Best effort.
      }
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track: any) => track.stop());
      } catch (error) {
        // Best effort.
      }
      localStreamRef.current = null;
    }
  }, []);

  const flushPendingIceCandidates = useCallback(async (callId: string, peerConnection: any) => {
    const pending = pendingIceCandidatesRef.current[callId] || [];
    if (!pending.length) return;

    const RTCIceCandidate = WebRTC?.RTCIceCandidate;
    for (const candidate of pending) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('[CallContext] Failed to apply queued ICE candidate', error);
      }
    }
    pendingIceCandidatesRef.current[callId] = [];
  }, []);

  const getIceServersForSession = useCallback(async () => {
    const cacheAgeMs = Date.now() - iceServersFetchedAtRef.current;
    if (iceServersCacheRef.current && cacheAgeMs < 10 * 60 * 1000) {
      return iceServersCacheRef.current;
    }

    try {
      const response = await apiClient.get<{ ice_servers?: any[] }>('/turn/ice-servers/');
      const servers = Array.isArray(response?.ice_servers)
        ? response.ice_servers
            .filter((server) => server && server.urls)
            .map((server) => ({
              urls: server.urls,
              username: server.username,
              credential: server.credential,
            }))
        : [];

      if (servers.length) {
        console.log('[CallContext] Loaded ICE servers from backend:', servers.length);
        iceServersCacheRef.current = servers;
        iceServersFetchedAtRef.current = Date.now();
        return servers;
      }
    } catch (error) {
      console.warn('[CallContext] Failed to load ICE servers from backend, using fallback');
    }

    const fallback = getFallbackIceServers();
    console.log('[CallContext] Using fallback ICE servers:', fallback.length);
    iceServersCacheRef.current = fallback;
    iceServersFetchedAtRef.current = Date.now();
    return fallback;
  }, []);

  const buildPeerConnection = useCallback(async (call: Call) => {
    if (!isWebRTCEnabled) {
      console.warn('[CallContext] WebRTC is not enabled in this build');
      return null;
    }

    console.log('[CallContext] Building peer connection for call:', call.id, call.call_type);

    cleanupPeerConnection();

    const { RTCPeerConnection, mediaDevices } = WebRTC;
    const iceServers = await getIceServersForSession();
    const peerConnection = new RTCPeerConnection({
      iceServers,
    });

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'connected') {
        console.log('[CallContext] WebRTC connected');
      } else if (state === 'failed' || state === 'disconnected') {
        console.warn('[CallContext] WebRTC state:', state);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('[CallContext] ICE state:', peerConnection.iceConnectionState);
    };

    peerConnection.ontrack = (event: any) => {
      const hasAudio = event?.track?.kind === 'audio';
      if (hasAudio) {
        // Keep speaker route active when remote audio track is available.
        startAudioSession(call.call_type);
      }
    };

    peerConnection.onicecandidate = (event: any) => {
      if (!event?.candidate) return;
      emitSocketEvent({
        type: 'call.ice-candidate',
        call_id: call.id,
        candidate: event.candidate,
      });
    };

    try {
      if (Platform.OS === 'android') {
        const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
        if (call.call_type === 'video') {
          permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        }
        const permissionResult = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = permissions.every(
          (permission) => permissionResult[permission] === PermissionsAndroid.RESULTS.GRANTED
        );
        if (!allGranted) {
          console.warn('[CallContext] Missing Android media permissions for call');
        }
      }

      const localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: call.call_type === 'video',
      });

      localStreamRef.current = localStream;
      localStream.getTracks().forEach((track: any) => peerConnection.addTrack(track, localStream));
      try {
        peerConnection.addTransceiver?.('audio', { direction: 'sendrecv' });
        if (call.call_type === 'video') {
          peerConnection.addTransceiver?.('video', { direction: 'sendrecv' });
        }
      } catch (error) {
        // Some WebRTC builds do not support explicit transceivers.
      }
      console.log('[CallContext] Local media tracks:', localStream.getTracks().map((t: any) => t.kind));
    } catch (error) {
      console.warn('[CallContext] Could not get local media stream', error);
    }

    peerConnectionRef.current = peerConnection;
    await flushPendingIceCandidates(String(call.id), peerConnection);
    return peerConnection;
  }, [cleanupPeerConnection, emitSocketEvent, flushPendingIceCandidates, getIceServersForSession, isWebRTCEnabled, startAudioSession]);

  const answerOfferForCall = useCallback(async (call: Call, offer: any) => {
    if (!isWebRTCEnabled || !offer) return;

    try {
      const existing = peerConnectionRef.current;
      if (existing?.currentRemoteDescription) {
        return;
      }

      const peerConnection = existing || (await buildPeerConnection(call));
      if (!peerConnection) return;

      const { RTCSessionDescription } = WebRTC;
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      emitSocketEvent({
        type: 'call.answer',
        call_id: call.id,
        answer,
      });

      await flushPendingIceCandidates(String(call.id), peerConnection);
    } catch (error) {
      console.warn('[CallContext] Failed to answer WebRTC offer', error);
    }
  }, [buildPeerConnection, emitSocketEvent, flushPendingIceCandidates, isWebRTCEnabled]);

  const hydrateCall = useCallback(async (callId: number | string) => {
    try {
      const call = await apiClient.get<Call>(`/calls/${callId}/`);
      if (call.status === 'ringing') {
        setIncomingCall(call);
      } else if (call.status === 'active') {
        clearCallTimeout();
        startAudioSession(call.call_type);
        setIncomingCall(null);
        setActiveCall(call);
        setOutgoingCall(null);
      } else if (['ended', 'rejected', 'missed', 'cancelled'].includes(call.status)) {
        stopAudioSession();
        cleanupPeerConnection();
        setIncomingCall(null);
        setActiveCall(null);
        setOutgoingCall(null);
      }
      return call;
    } catch (error) {
      console.error('[CallContext] Failed to hydrate call', callId, error);
      return null;
    }
  }, [cleanupPeerConnection, clearCallTimeout, startAudioSession, stopAudioSession]);

  const handleSocketMessage = useCallback(async (raw: string) => {
    try {
      const data = JSON.parse(raw);

      if (data.type === 'connection.ack' || data.type === 'pong') {
        return;
      }

      if (data.type === 'call.incoming' || data.type === 'call.offer') {
        const callId = data.call_id ? String(data.call_id) : null;
        if (data.type === 'call.offer' && data.offer && callId) {
          pendingOffersRef.current[callId] = data.offer;
        }
        const call = await hydrateCall(data.call_id);
        if (
          call &&
          data.type === 'call.offer' &&
          data.offer &&
          String(call.receiver?.id) === String(user?.id) &&
          call.status === 'active'
        ) {
          await answerOfferForCall(call, data.offer);
        }
        if (call && call.receiver?.id === user?.id && call.status === 'ringing') {
          setIncomingCall(call);
        }
        return;
      }

      if (data.type === 'call.answer') {
        const call = await hydrateCall(data.call_id);
        if (call?.status === 'active') {
          if (data.answer && isWebRTCEnabled && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
            try {
              const { RTCSessionDescription } = WebRTC;
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
              await flushPendingIceCandidates(String(call.id), peerConnectionRef.current);
            } catch (error) {
              console.warn('[CallContext] Failed to apply remote answer', error);
            }
          }
          clearCallTimeout();
          startAudioSession(call.call_type);
          setActiveCall(call);
          setOutgoingCall(null);
        }
        return;
      }

      if (data.type === 'call.rejected') {
        clearCallTimeout();
        stopAudioSession();
        cleanupPeerConnection();
        setOutgoingCall((current) => (String(current?.id) === String(data.call_id) ? null : current));
        showToast('Call declined', 'info', 3000);
        return;
      }

      if (data.type === 'call.ice-candidate' && data.call_id && data.candidate) {
        const callId = String(data.call_id);
        if (
          peerConnectionRef.current &&
          (String(activeCall?.id) === callId ||
            String(outgoingCall?.id) === callId ||
            String(incomingCall?.id) === callId)
        ) {
          try {
            const { RTCIceCandidate } = WebRTC;
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (error) {
            console.warn('[CallContext] Failed to apply ICE candidate', error);
          }
        } else {
          if (!pendingIceCandidatesRef.current[callId]) {
            pendingIceCandidatesRef.current[callId] = [];
          }
          pendingIceCandidatesRef.current[callId].push(data.candidate);
        }
        return;
      }

      if (data.type === 'call.end') {
        const wasPendingOutgoing = String(outgoingCall?.id) === String(data.call_id) && !activeCall;
        const wasActiveCall = String(activeCall?.id) === String(data.call_id);
        const endedByOther = data.user_id ? String(data.user_id) !== String(user?.id) : true;
        stopAudioSession();
        cleanupPeerConnection();
        setIncomingCall((current) => (String(current?.id) === String(data.call_id) ? null : current));
        setActiveCall((current) => (String(current?.id) === String(data.call_id) ? null : current));
        setOutgoingCall((current) => (String(current?.id) === String(data.call_id) ? null : current));
        if (wasPendingOutgoing) {
          showToast('Call declined', 'info', 3000);
        } else if (wasActiveCall && endedByOther) {
          showToast('Call ended', 'info', 3000);
        }
        return;
      }
    } catch (error) {
      console.error('[CallContext] Failed to parse call socket message', error);
    }
  }, [activeCall?.id, answerOfferForCall, cleanupPeerConnection, clearCallTimeout, flushPendingIceCandidates, hydrateCall, incomingCall?.id, isWebRTCEnabled, outgoingCall?.id, showToast, startAudioSession, stopAudioSession, user?.id]);

  const disconnectNotificationsSocket = useCallback(() => {
    clearReconnectTimeout();
    clearIncomingTimeout();
    if (activePollRef.current) {
      clearInterval(activePollRef.current);
      activePollRef.current = null;
    }
    if (incomingStatusPollRef.current) {
      clearInterval(incomingStatusPollRef.current);
      incomingStatusPollRef.current = null;
    }
    Object.keys(endRetryTimeoutsRef.current).forEach((key) => {
      const id = Number(key);
      clearEndRetry(id);
    });
    if (incomingPollRef.current) {
      clearInterval(incomingPollRef.current);
      incomingPollRef.current = null;
    }
    if (outgoingPollRef.current) {
      clearInterval(outgoingPollRef.current);
      outgoingPollRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Call provider disconnect');
      wsRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
  }, [clearEndRetry, clearIncomingTimeout, clearReconnectTimeout]);

  const pollIncomingCalls = useCallback(async () => {
    if (!user) return;
    if (incomingCall || activeCall || outgoingCall) return;

    try {
      const response = await apiClient.get<any>('/calls/');
      const calls: Call[] = Array.isArray(response) ? response : (response?.results || []);
      if (!calls.length) return;

      const latestRinging = calls.find(
        (call) =>
          call.status === 'ringing' &&
          String(call.receiver?.id) === String(user.id)
      );

      if (latestRinging) {
        setIncomingCall(latestRinging);
      }
    } catch (error) {
      // Polling is best-effort fallback for missed websocket events.
    }
  }, [user, incomingCall, activeCall, outgoingCall]);

  const connectNotificationsSocket = useCallback(async () => {
    if (!user) return;

    try {
      const token = await storage.getAccessToken();
      if (!token) return;

      const wsBase = getWsBase();
      const wsUrl = `${wsBase}/ws/notifications/?token=${token}`;

      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        clearReconnectTimeout();
        console.log('[CallContext] Notifications WebSocket connected');
        flushPendingSocketEvents();
      };

      ws.onmessage = (event) => {
        handleSocketMessage(event.data);
      };

      ws.onerror = (error) => {
        console.log('[CallContext] Notifications WebSocket error', error);
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        if (!user) return;
        if (event.code === 1000) return;

        if (reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connectNotificationsSocket();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[CallContext] Failed to connect notifications WebSocket', error);
    }
  }, [clearReconnectTimeout, flushPendingSocketEvents, handleSocketMessage, user]);

  useEffect(() => {
    if (!user) {
      disconnectNotificationsSocket();
      stopAudioSession();
      cleanupPeerConnection();
      setIncomingCall(null);
      setOutgoingCall(null);
      setActiveCall(null);
      return;
    }

    connectNotificationsSocket();
    pollIncomingCalls();
    incomingPollRef.current = setInterval(() => {
      pollIncomingCalls();
    }, 3000);

    return () => {
      disconnectNotificationsSocket();
      stopAudioSession();
      cleanupPeerConnection();
    };
  }, [cleanupPeerConnection, connectNotificationsSocket, disconnectNotificationsSocket, pollIncomingCalls, stopAudioSession, user]);

  useEffect(() => {
    if (!incomingCall?.id) {
      if (incomingStatusPollRef.current) {
        clearInterval(incomingStatusPollRef.current);
        incomingStatusPollRef.current = null;
      }
      return;
    }

    const pollIncomingStatus = async () => {
      try {
        const call = await apiClient.get<Call>(`/calls/${incomingCall.id}/`);
        if (call.status !== 'ringing') {
          clearIncomingTimeout();
          stopAudioSession();
          cleanupPeerConnection();
          setIncomingCall((current) => (String(current?.id) === String(call.id) ? null : current));
          setActiveCall((current) => (String(current?.id) === String(call.id) ? null : current));
          setOutgoingCall((current) => (String(current?.id) === String(call.id) ? null : current));
        }
      } catch (error) {
        // Best effort fallback when realtime event is missed.
      }
    };

    pollIncomingStatus();
    incomingStatusPollRef.current = setInterval(pollIncomingStatus, 1500);

    return () => {
      if (incomingStatusPollRef.current) {
        clearInterval(incomingStatusPollRef.current);
        incomingStatusPollRef.current = null;
      }
    };
  }, [cleanupPeerConnection, clearIncomingTimeout, incomingCall?.id, stopAudioSession]);

  useEffect(() => {
    if (!activeCall?.id) {
      if (activePollRef.current) {
        clearInterval(activePollRef.current);
        activePollRef.current = null;
      }
      return;
    }

    const pollActiveStatus = async () => {
      try {
        const call = await apiClient.get<Call>(`/calls/${activeCall.id}/`);
        if (['ended', 'rejected', 'missed', 'cancelled'].includes(call.status)) {
          stopAudioSession();
          cleanupPeerConnection();
          setActiveCall(null);
          setIncomingCall((current) => (String(current?.id) === String(call.id) ? null : current));
          setOutgoingCall((current) => (String(current?.id) === String(call.id) ? null : current));
          showToast('Call ended', 'info', 3000);
        }
      } catch (error) {
        // Best effort fallback when realtime end event is missed.
      }
    };

    pollActiveStatus();
    activePollRef.current = setInterval(pollActiveStatus, 2000);

    return () => {
      if (activePollRef.current) {
        clearInterval(activePollRef.current);
        activePollRef.current = null;
      }
    };
  }, [activeCall?.id, cleanupPeerConnection, showToast, stopAudioSession]);

  useEffect(() => {
    if (!outgoingCall?.id) {
      if (outgoingPollRef.current) {
        clearInterval(outgoingPollRef.current);
        outgoingPollRef.current = null;
      }
      return;
    }

    const pollOutgoingStatus = async () => {
      try {
        const call = await apiClient.get<Call>(`/calls/${outgoingCall.id}/`);
        if (call.status === 'active') {
          clearCallTimeout();
          startAudioSession(call.call_type);
          setOutgoingCall(null);
          setIncomingCall(null);
          setActiveCall(call);
          return;
        }

        if (call.status === 'rejected') {
          clearCallTimeout();
          stopAudioSession();
          cleanupPeerConnection();
          setOutgoingCall(null);
          showToast('Call declined', 'info', 3000);
          return;
        }

        if (['ended', 'rejected', 'missed', 'cancelled'].includes(call.status)) {
          clearCallTimeout();
          stopAudioSession();
          cleanupPeerConnection();
          setOutgoingCall(null);
        }
      } catch (error) {
        // Best-effort fallback to keep caller and receiver call state in sync.
      }
    };

    pollOutgoingStatus();
    outgoingPollRef.current = setInterval(pollOutgoingStatus, 1500);

    return () => {
      if (outgoingPollRef.current) {
        clearInterval(outgoingPollRef.current);
        outgoingPollRef.current = null;
      }
    };
  }, [cleanupPeerConnection, clearCallTimeout, outgoingCall?.id, showToast, startAudioSession, stopAudioSession]);

  const initiateCall = useCallback(
    async (receiverId: number, callType: 'voice' | 'video', conversationId?: number) => {
      try {
        console.log('[CallContext] Initiating call:', { receiverId, callType, conversationId });

        // Call backend to initiate
        const response = await apiClient.post<Call>('/calls/initiate/', {
          receiver_id: receiverId,
          call_type: callType,
          conversation_id: conversationId,
        });

        console.log('[CallContext] Call initiated:', response);
        setOutgoingCall(response);

        if (isWebRTCEnabled) {
          const peerConnection = await buildPeerConnection(response);
          if (peerConnection) {
            try {
              const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: response.call_type === 'video',
              });
              await peerConnection.setLocalDescription(offer);
              console.log('[CallContext] Created local offer for call:', response.id);
              emitSocketEvent({
                type: 'call.offer',
                call_id: response.id,
                call_type: response.call_type,
                conversation_id: response.conversation,
                offer,
              });
            } catch (error) {
              console.warn('[CallContext] Failed to create/send WebRTC offer', error);
            }
          }
        } else {
          showToast('Audio call media is unavailable in this build', 'error', 3500);
        }

        // Set timeout for ringing (30 seconds)
        clearCallTimeout();
        callTimerRef.current = setTimeout(() => {
          console.log('[CallContext] Call timeout - no answer');
          stopAudioSession();
          cleanupPeerConnection();
          emitSocketEvent({
            type: 'call.end',
            call_id: response.id,
          });
          apiClient.post(`/calls/${response.id}/end/`, {
            duration_seconds: 0,
          }).catch(() => {
            // Silent by design.
          });
          setOutgoingCall(null);
          showToast('Call ended • No answer', 'info', 3000);
        }, 30000);
      } catch (error) {
        console.error('[CallContext] Error initiating call:', error);
        stopAudioSession();
        cleanupPeerConnection();
        setOutgoingCall(null);
        throw error;
      }
    },
    [buildPeerConnection, cleanupPeerConnection, clearCallTimeout, emitSocketEvent, isWebRTCEnabled, showToast, stopAudioSession, user?.id, user?.username]
  );

  const answerCall = useCallback(
    async (callId: number) => {
      try {
        console.log('[CallContext] Answering call:', callId);

        const response = await apiClient.post<Call>(`/calls/${callId}/accept/`, {});

        console.log('[CallContext] Call answered:', response);

        const incomingOffer = pendingOffersRef.current[String(response.id)];
        if (incomingOffer) {
          await answerOfferForCall(response, incomingOffer);
        } else if (isWebRTCEnabled) {
          console.log('[CallContext] Answered call without offer yet; waiting for delayed offer');
        }

        startAudioSession(response.call_type);
        setIncomingCall(null);
        setActiveCall(response);
        setOutgoingCall(null);

        // TODO: Send answer via WebSocket when integrated
      } catch (error) {
        console.error('[CallContext] Error answering call:', error);
        throw error;
      }
    },
    [answerOfferForCall, startAudioSession]
  );

  const rejectCall = useCallback(
    async (callId: number) => {
      console.log('[CallContext] Rejecting call:', callId);

      // Optimistic local cleanup first.
      clearCallTimeout();
      stopAudioSession();
      cleanupPeerConnection();
      setIncomingCall((current) => (String(current?.id) === String(callId) ? null : current));
      setActiveCall((current) => (String(current?.id) === String(callId) ? null : current));
      setOutgoingCall((current) => (String(current?.id) === String(callId) ? null : current));

      // Realtime sync for remote side.
      emitSocketEvent({
        type: 'call.end',
        call_id: callId,
      });

      // Persist in backend, but fail silently on bad network.
      try {
        await apiClient.post(`/calls/${callId}/reject/`, {});
      } catch (apiError) {
        // Silent by design.
      }
    },
    [cleanupPeerConnection, clearCallTimeout, emitSocketEvent, stopAudioSession]
  );

  useEffect(() => {
    clearIncomingTimeout();

    if (!incomingCall || incomingCall.status !== 'ringing') {
      return;
    }

    const startedAt = new Date(incomingCall.started_at).getTime();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 30000 - elapsed);

    incomingTimeoutRef.current = setTimeout(() => {
      rejectCall(incomingCall.id).catch(() => {
        // Silent by design.
      });
    }, remaining);

    return () => {
      clearIncomingTimeout();
    };
  }, [clearIncomingTimeout, incomingCall?.id, incomingCall?.started_at, incomingCall?.status, rejectCall]);

  const endCall = useCallback(async () => {
    // Capture current call state at the time this function is called
    const call = activeCall || outgoingCall;
    if (!call) {
      return;
    }

    // Optimistic local cleanup first.
    clearCallTimeout();
    stopAudioSession();
    cleanupPeerConnection();

    setActiveCall((current) => (String(current?.id) === String(call.id) ? null : current));
    setOutgoingCall((current) => (String(current?.id) === String(call.id) ? null : current));
    setIncomingCall((current) => (String(current?.id) === String(call.id) ? null : current));

    // Realtime sync for remote side.
    emitSocketEvent({
      type: 'call.end',
      call_id: call.id,
    });

    // Persist in backend, but fail silently on bad network.
    const duration = Math.floor(
      (Date.now() - new Date(call.started_at).getTime()) / 1000
    );

    persistCallEndWithRetry(call.id, duration, 0);
  }, [activeCall, cleanupPeerConnection, clearCallTimeout, emitSocketEvent, outgoingCall, persistCallEndWithRetry, stopAudioSession]);

  return (
    <CallContext.Provider
      value={{
        incomingCall,
        activeCall,
        outgoingCall,
        initiateCall,
        answerCall,
        rejectCall,
        endCall,
        setIncomingCall,
        setActiveCall,
        setOutgoingCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
}
