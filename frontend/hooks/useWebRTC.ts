"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { apiPost } from "@/lib/api";
import type SimplePeerType from "simple-peer";

// Dynamic import for simple-peer to avoid Next.js/Turbopack issues
let SimplePeer: any = null;
if (typeof window !== "undefined") {
  import("simple-peer").then((module) => {
    SimplePeer = module.default || module;
  });
}

interface UseWebRTCOptions {
  conversationId?: string;
  onCallIncoming?: (call: any) => void;
  onCallAccepted?: (call: any) => void;
  onCallEnded?: (call: any) => void;
}

export function useWebRTC(options: UseWebRTCOptions = {}) {
  const { conversationId, onCallIncoming, onCallAccepted, onCallEnded } = options;
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callType, setCallType] = useState<"voice" | "video">("voice");
  const [currentCall, setCurrentCall] = useState<any>(null);
  const pendingOfferRef = useRef<any>(null); // Store offer SDP until peer is created
  const offerSignaledRef = useRef<boolean>(false); // Track if offer has been signaled to peer

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<SimplePeerType.Instance | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // STUN servers
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const getLocalStream = useCallback(async (type: "voice" | "video") => {
    console.log("[WebRTC] getLocalStream called with type:", type);

    // First, stop any existing stream to release the camera/mic
    if (localStream) {
      console.log("[WebRTC] Stopping existing stream before requesting new one");
      localStream.getTracks().forEach((track) => {
        console.log(`[WebRTC] Stopping track: ${track.kind} (${track.label})`);
        track.stop();
      });
      setLocalStream(null);
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === "video" ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        } : false,
      };

      console.log("[WebRTC] Requesting media with constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("[WebRTC] ✅ Stream obtained, tracks:", stream.getTracks().map(t => `${t.kind}: ${t.label}`));

      setLocalStream(stream);

      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error: any) {
      console.error("[WebRTC] ❌ Error getting local stream:", error);
      console.error("[WebRTC] Error name:", error.name);
      console.error("[WebRTC] Error message:", error.message);

      // Provide user-friendly error messages
      if (error.name === "NotReadableError") {
        throw new Error("Camera is already in use by another application or tab. Please close other applications using your camera and try again.");
      } else if (error.name === "NotAllowedError") {
        throw new Error("Camera/microphone permission denied. Please allow access in your browser settings.");
      } else if (error.name === "NotFoundError") {
        throw new Error("No camera/microphone found. Please connect a camera and try again.");
      }

      throw error;
    }
  }, [localStream]);

  const stopLocalStream = useCallback(() => {
    if (localStream) {
      console.log("[WebRTC] stopLocalStream: Stopping all tracks");
      localStream.getTracks().forEach((track) => {
        console.log(`[WebRTC] Stopping track: ${track.kind} (${track.label})`);
        track.stop();
      });
      setLocalStream(null);
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, [localStream]);

  const initiateCall = useCallback(
    async (receiverId: string, type: "voice" | "video" = "voice", callConversationId?: string) => {
      console.log("[WebRTC] initiateCall called with:", { receiverId, type, conversationId: callConversationId || conversationId });
      try {
        setCallType(type);
        
        // Ensure SimplePeer is loaded
        if (!SimplePeer && typeof window !== "undefined") {
          const module = await import("simple-peer");
          SimplePeer = module.default || module;
        }
        
        if (!SimplePeer) {
          throw new Error("SimplePeer not available");
        }
        
        // Call API to initiate call
        const response = await apiPost("/calls/initiate/", {
          receiver_id: receiverId,
          call_type: type,
          conversation_id: callConversationId || conversationId,
        });
        console.log("[WebRTC] ✅ API response:", response);

        const call = response;
        setCurrentCall(call);

        // Get local media
        const stream = await getLocalStream(type);
        
        // Create peer as initiator
        const peer = new SimplePeer({
          initiator: true,
          trickle: false,
          stream: stream,
          config: iceServers,
        });

        peerRef.current = peer;

        // Handle signal data (offer)
        peer.on("signal", (data: SimplePeerType.SignalData) => {
          console.log("[WebRTC] Signal data (offer) generated");
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "call.offer",
                call_id: call.id.toString(),
                call_type: type,
                caller_id: call.caller?.id?.toString() || call.caller_id?.toString(),
                caller_username: call.caller?.username || call.caller_username,
                offer: data,
              })
            );
            console.log("[WebRTC] ✅ Offer sent via WebSocket");
          } else {
            console.error("[WebRTC] ❌ WebSocket not connected");
          }
        });

        // Handle remote stream
        peer.on("stream", (stream: MediaStream) => {
          console.log("[WebRTC] ✅ Remote stream received (initiator)");
          console.log("[WebRTC] Remote stream tracks:", stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })));
          setRemoteStream(stream);

          // For video calls, use video element
          if (remoteVideoRef.current && type === "video") {
            remoteVideoRef.current.srcObject = stream;
            // Ensure video plays (especially important for audio in video element)
            remoteVideoRef.current.play().catch((err) => {
              console.error("[WebRTC] Error playing remote video:", err);
            });
            console.log("[WebRTC] ✅ Remote video element set and playing (initiator)");
          }

          // For voice calls, create/use audio element
          if (type === "voice") {
            // Create audio element if it doesn't exist
            if (!remoteAudioRef.current) {
              const audio = document.createElement("audio");
              audio.autoplay = true;
              document.body.appendChild(audio);
              remoteAudioRef.current = audio;
            }
            remoteAudioRef.current.srcObject = stream;
            remoteAudioRef.current.play().catch((err) => {
              console.error("[WebRTC] Error playing remote audio:", err);
            });
            console.log("[WebRTC] ✅ Remote audio element set and playing (initiator)");
          }
        });

        // Handle connection
        peer.on("connect", () => {
          console.log("[WebRTC] ✅ Peer connected");
          setIsCallActive(true);
        });

        // Handle errors
        peer.on("error", (err: Error) => {
          console.error("[WebRTC] ❌ Peer error:", err);
        });

        // Handle close
        peer.on("close", () => {
          console.log("[WebRTC] Peer connection closed");
          setIsCallActive(false);
        });

        setIsCallActive(true);
        console.log("[WebRTC] ✅ Call initiated successfully");
        return call;
      } catch (error: any) {
        console.error("[WebRTC] ❌ Error initiating call:", error);
        stopLocalStream();
        throw error;
      }
    },
    [conversationId, getLocalStream, stopLocalStream]
  );

  const answerCall = useCallback(
    async (call: any, type: "voice" | "video" = "voice") => {
      if (isCallActive || currentCall) {
        console.warn("[WebRTC] ⚠️ Call already active, ignoring duplicate answerCall");
        return;
      }

      try {
        console.log("[WebRTC] answerCall called with:", { call, type });

        // Ensure SimplePeer is loaded
        if (!SimplePeer && typeof window !== "undefined") {
          const module = await import("simple-peer");
          SimplePeer = module.default || module;
        }

        if (!SimplePeer) {
          throw new Error("SimplePeer not available");
        }

        setCallType(type);
        setCurrentCall(call);

        // Get local media
        const stream = await getLocalStream(type);

        // Accept call via API
        await apiPost(`/calls/${call.id}/accept/`, {});
        console.log("[WebRTC] ✅ Call accepted via API");

        // Wait for offer if we don't have it yet (with timeout)
        if (!pendingOfferRef.current && !call.offer) {
          console.log("[WebRTC] No offer yet, waiting up to 5 seconds...");
          let waitTime = 0;
          const maxWait = 5000;
          const checkInterval = 100;

          while (!pendingOfferRef.current && waitTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitTime += checkInterval;
          }

          if (!pendingOfferRef.current) {
            throw new Error("Timeout waiting for offer SDP");
          }
          console.log("[WebRTC] ✅ Offer received after waiting");
        } else if (call.offer && !pendingOfferRef.current) {
          // Offer came with the call object
          pendingOfferRef.current = call.offer;
          console.log("[WebRTC] Using offer from call object");
        }

        // Check if we have a pending offer before creating peer
        const hasPendingOffer = !!pendingOfferRef.current;
        console.log("[WebRTC] Has pending offer:", hasPendingOffer);

        // Create peer as receiver (not initiator)
        const peer = new SimplePeer({
          initiator: false,
          trickle: false,
          stream: stream,
          config: iceServers,
        });

        peerRef.current = peer;

        // Handle signal data (answer)
        peer.on("signal", (data: SimplePeerType.SignalData) => {
          console.log("[WebRTC] Signal data (answer) generated");
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "call.answer",
                call_id: call.id.toString(),
                answer: data,
              })
            );
            console.log("[WebRTC] ✅ Answer sent via WebSocket");
          }
        });

        // Handle remote stream
        peer.on("stream", (stream: MediaStream) => {
          console.log("[WebRTC] ✅ Remote stream received (receiver)");
          console.log("[WebRTC] Remote stream tracks:", stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })));
          setRemoteStream(stream);

          // For video calls, use video element
          if (remoteVideoRef.current && type === "video") {
            remoteVideoRef.current.srcObject = stream;
            // Ensure video plays (especially important for audio in video element)
            remoteVideoRef.current.play().catch((err) => {
              console.error("[WebRTC] Error playing remote video:", err);
            });
            console.log("[WebRTC] ✅ Remote video element set and playing (receiver)");
          }

          // For voice calls, create/use audio element
          if (type === "voice") {
            // Create audio element if it doesn't exist
            if (!remoteAudioRef.current) {
              const audio = document.createElement("audio");
              audio.autoplay = true;
              document.body.appendChild(audio);
              remoteAudioRef.current = audio;
            }
            remoteAudioRef.current.srcObject = stream;
            remoteAudioRef.current.play().catch((err) => {
              console.error("[WebRTC] Error playing remote audio:", err);
            });
            console.log("[WebRTC] ✅ Remote audio element set and playing (receiver)");
          }
        });

        // Handle connection
        peer.on("connect", () => {
          console.log("[WebRTC] ✅ Peer connected - WebRTC connection established!");
          console.log("[WebRTC] Peer state:", {
            destroyed: peer.destroyed,
            connected: peer.connected,
          });
          setIsCallActive(true);
          onCallAccepted?.(call);
        });

        // Handle errors
        peer.on("error", (err: Error) => {
          console.error("[WebRTC] ❌ Peer error:", err);
        });

        // Handle close
        peer.on("close", () => {
          console.log("[WebRTC] Peer connection closed");
          setIsCallActive(false);
        });

        // If we have a pending offer, set it immediately (synchronously, before any events)
        if (pendingOfferRef.current) {
          console.log("[WebRTC] Setting pending offer SDP on newly created peer");
          const offer = pendingOfferRef.current;
          pendingOfferRef.current = null;
          offerSignaledRef.current = true; // Mark as signaled
          // Set immediately - simple-peer needs the offer before it can create answer
          peer.signal(offer);
          console.log("[WebRTC] ✅ Pending offer signaled to peer");
        } else {
          console.log("[WebRTC] Waiting for offer SDP from caller...");
        }
      } catch (error) {
        console.error("[WebRTC] ❌ Error answering call:", error);
        stopLocalStream();
        throw error;
      }
    },
    [getLocalStream, stopLocalStream, onCallAccepted, currentCall, isCallActive]
  );

  const receiveOfferSDP = useCallback((offer: any) => {
    console.log("[WebRTC] receiveOfferSDP called with offer");

    // If offer has already been signaled, ignore duplicates
    if (offerSignaledRef.current) {
      console.log("[WebRTC] ⚠️ Offer already signaled to peer, ignoring duplicate");
      return;
    }

    // If we already have a pending offer and it's the same, skip it
    if (pendingOfferRef.current && JSON.stringify(pendingOfferRef.current) === JSON.stringify(offer)) {
      console.log("[WebRTC] ⚠️ Duplicate offer received, ignoring");
      return;
    }

    if (peerRef.current && !peerRef.current.destroyed) {
      console.log("[WebRTC] Setting offer signal data on existing peer");
      try {
        peerRef.current.signal(offer);
        console.log("[WebRTC] ✅ Offer signaled to peer");
        offerSignaledRef.current = true; // Mark as signaled
        pendingOfferRef.current = null; // Clear pending if we set it
      } catch (err: any) {
        console.error("[WebRTC] ❌ Error signaling offer to peer:", err);
        // If signaling fails, store it as pending
        if (!pendingOfferRef.current) {
          pendingOfferRef.current = offer;
        }
      }
    } else {
      console.log("[WebRTC] No peer connection yet, storing offer for when peer is created");
      pendingOfferRef.current = offer; // Store for when answerCall creates the peer
    }
  }, []);

  const receiveAnswerSDP = useCallback((answer: any) => {
    console.log("[WebRTC] receiveAnswerSDP called with answer:", answer);
    console.log("[WebRTC] Peer exists:", !!peerRef.current);
    console.log("[WebRTC] Peer destroyed:", peerRef.current?.destroyed);
    
    if (peerRef.current && !peerRef.current.destroyed) {
      console.log("[WebRTC] Setting answer signal data on peer");
      try {
        peerRef.current.signal(answer);
        console.log("[WebRTC] ✅ Answer signal data set successfully");
      } catch (error: any) {
        console.error("[WebRTC] ❌ Error setting answer signal:", error);
      }
    } else {
      console.error("[WebRTC] ❌ No peer connection to set answer");
      console.error("[WebRTC] peerRef.current:", peerRef.current);
    }
  }, []);

  const receiveIceCandidate = useCallback((candidate: any) => {
    console.log("[WebRTC] receiveIceCandidate called");
    if (peerRef.current && !peerRef.current.destroyed) {
      // simple-peer handles ICE candidates internally when trickle is false
      // If you need trickle ICE, you'd handle it here
    }
  }, []);

  const endCall = useCallback(async () => {
    try {
      console.log("[WebRTC] endCall called, cleaning up resources");

      // Destroy peer connection first
      if (peerRef.current && !peerRef.current.destroyed) {
        console.log("[WebRTC] Destroying peer connection");
        peerRef.current.destroy();
        peerRef.current = null;
      }

      // Clear pending offer and reset flags
      pendingOfferRef.current = null;
      offerSignaledRef.current = false;

      // Stop local stream
      console.log("[WebRTC] Stopping local stream");
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          console.log(`[WebRTC] Stopping local track: ${track.kind} (${track.label})`);
          track.stop();
        });
        setLocalStream(null);
      }

      // Clear local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      // Stop remote stream
      if (remoteStream) {
        console.log("[WebRTC] Stopping remote stream");
        remoteStream.getTracks().forEach((track) => {
          console.log(`[WebRTC] Stopping remote track: ${track.kind}`);
          track.stop();
        });
        setRemoteStream(null);
      }

      // Clear remote video element
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      // Clean up audio element
      if (remoteAudioRef.current) {
        console.log("[WebRTC] Cleaning up remote audio element");
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.pause();
        if (remoteAudioRef.current.parentNode) {
          remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
        }
        remoteAudioRef.current = null;
      }

      // Try to end call via API (but don't fail if it errors)
      if (currentCall) {
        try {
          const duration = Math.floor(
            (Date.now() - new Date(currentCall.started_at || Date.now()).getTime()) / 1000
          );
          await apiPost(`/calls/${currentCall.id}/end/`, {
            duration_seconds: duration,
          });
          console.log("[WebRTC] ✅ Call ended via API");
        } catch (error) {
          console.warn("[WebRTC] Error ending call via API (non-fatal):", error);
        }
      }

      setIsCallActive(false);
      const callToNotify = currentCall;
      setCurrentCall(null);
      console.log("[WebRTC] ✅ Call cleanup complete");
      onCallEnded?.(callToNotify);
    } catch (error) {
      console.error("[WebRTC] Error ending call:", error);
    }
  }, [currentCall, localStream, remoteStream, onCallEnded]);

  const rejectCall = useCallback(async (callId: string) => {
    try {
      await apiPost(`/calls/${callId}/reject/`, {});
    } catch (error) {
      console.error("Error rejecting call:", error);
    }
  }, []);

  // Handle WebSocket messages for call signaling
  useEffect(() => {
    if (!wsRef.current) return;

    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "call.answer":
            console.log("[WebRTC] Received call.answer message:", data);
            if (data.answer) {
              console.log("[WebRTC] Answer SDP present, calling receiveAnswerSDP");
              receiveAnswerSDP(data.answer);
            } else {
              console.warn("[WebRTC] ⚠️ call.answer message received but no answer SDP");
            }
            break;

          case "call.ice-candidate":
            if (data.candidate) {
              receiveIceCandidate(data.candidate);
            }
            break;
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    wsRef.current.addEventListener("message", handleMessage);

    return () => {
      if (wsRef.current) {
        wsRef.current.removeEventListener("message", handleMessage);
      }
    };
  }, [receiveAnswerSDP, receiveIceCandidate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!isCallActive && !currentCall) {
        stopLocalStream();
        if (peerRef.current && !peerRef.current.destroyed) {
          peerRef.current.destroy();
        }
      }
    };
  }, [stopLocalStream, isCallActive, currentCall]);

  return {
    localStream,
    remoteStream,
    isCallActive,
    callType,
    currentCall,
    localVideoRef,
    remoteVideoRef,
    initiateCall,
    answerCall,
    endCall,
    rejectCall,
    receiveOfferSDP,
    receiveAnswerSDP,
    setWebSocket: (ws: WebSocket | null) => {
      if (wsRef.current === ws) {
        return;
      }
      console.log("[WebRTC] setWebSocket called, readyState:", ws?.readyState);
      wsRef.current = ws;
      console.log("[WebRTC] ✅ WebSocket ref updated");
    },
  };
}
