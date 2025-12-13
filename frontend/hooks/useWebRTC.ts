"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { apiPost, apiGet } from "@/lib/api";

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
  const [pendingOfferSDP, setPendingOfferSDP] = useState<RTCSessionDescriptionInit | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const offerSDPResolverRef = useRef<((offer: RTCSessionDescriptionInit) => void) | null>(null);

  // STUN/TURN servers (using free public STUN servers)
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const createPeerConnection = useCallback((stream?: MediaStream | null) => {
    console.log("[WebRTC] Creating new RTCPeerConnection");
    const pc = new RTCPeerConnection(iceServers);

    // Add local stream tracks - use provided stream or fallback to state
    const streamToUse = stream || localStream;
    if (streamToUse) {
      console.log("[WebRTC] Adding tracks to peer connection:", streamToUse.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })));
      streamToUse.getTracks().forEach((track) => {
        pc.addTrack(track, streamToUse);
      });
      console.log("[WebRTC] ✅ Tracks added to peer connection");
    } else {
      console.warn("[WebRTC] ⚠️ No stream provided to createPeerConnection");
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log("[WebRTC] Remote track received:", event.track);
      const [remoteStream] = event.streams;
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentCall) {
        console.log("[WebRTC] Sending ICE candidate:", event.candidate);
        wsRef.current.send(
          JSON.stringify({
            type: "call.ice-candidate",
            call_id: currentCall.id,
            candidate: event.candidate,
          })
        );
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Peer connection state changed:", pc.connectionState);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        console.log("[WebRTC] Peer connection disconnected/failed");
      } else if (pc.connectionState === "closed") {
        console.warn("[WebRTC] ⚠️ Peer connection was closed - this should not happen during call setup!");
      }
    };

    // Handle signaling state changes
    pc.onsignalingstatechange = () => {
      console.log("[WebRTC] Signaling state changed:", pc.signalingState);
    };

    // Handle negotiation needed
    pc.onnegotiationneeded = async () => {
      console.log("[WebRTC] Negotiation needed. Signaling state:", pc.signalingState);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [localStream, currentCall]);

  const getLocalStream = useCallback(async (type: "voice" | "video") => {
    console.log("[WebRTC] getLocalStream called with type:", type);
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === "video",
      };
      console.log("[WebRTC] Requesting media with constraints:", constraints);
      console.log("[WebRTC] Waiting for user permission...");

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("[WebRTC] ✅ Permission granted, stream obtained:", stream);
      console.log("[WebRTC] Stream tracks:", stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })));
      
      setLocalStream(stream);
      console.log("[WebRTC] Local stream set in state");
      
      if (localVideoRef.current && type === "video") {
        console.log("[WebRTC] Setting stream to local video element");
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error: any) {
      console.error("[WebRTC] ❌ Error getting local stream:", error);
      console.error("[WebRTC] Error name:", error?.name);
      console.error("[WebRTC] Error message:", error?.message);
      throw error;
    }
  }, []);

  const initiateCall = useCallback(
    async (receiverId: string, type: "voice" | "video" = "voice") => {
      console.log("[WebRTC] initiateCall called with:", { receiverId, type });
      try {
        setCallType(type);
        
        // FIRST: Call API to initiate call (this sends notification to receiver)
        console.log("[WebRTC] Calling API to initiate call...");
        const response = await apiPost("/calls/initiate/", {
          receiver_id: receiverId,
          call_type: type,
          conversation_id: conversationId,
        });
        console.log("[WebRTC] ✅ API response:", response);

        const call = response;
        setCurrentCall(call);
        console.log("[WebRTC] Current call set:", call);

        // THEN: Get local media and create offer
        console.log("[WebRTC] Getting local media stream...");
        const stream = await getLocalStream(type);
        console.log("[WebRTC] ✅ Local stream obtained:", stream);
        console.log("[WebRTC] Stream tracks:", stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })));
        
        console.log("[WebRTC] Creating peer connection with stream...");
        const pc = createPeerConnection(stream); // Pass stream directly!
        console.log("[WebRTC] ✅ Peer connection created with tracks");
        
        console.log("[WebRTC] Creating offer...");
        let offer: RTCSessionDescriptionInit;
        try {
          offer = await pc.createOffer();
          console.log("[WebRTC] ✅ Offer created, type:", offer.type, "sdp length:", offer.sdp?.length);
          console.log("[WebRTC] Peer connection state before setLocalDescription:", {
            signalingState: pc.signalingState,
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
          });
          
          // CRITICAL: Set local description in the background, don't wait for it
          // Some browsers hang on setLocalDescription, but we can still send the offer
          console.log("[WebRTC] Setting local description (non-blocking)...");
          const setLocalDescPromise = pc.setLocalDescription(offer).then(() => {
            console.log("[WebRTC] ✅ Local description set successfully");
            console.log("[WebRTC] Peer connection state after setLocalDescription:", {
              signalingState: pc.signalingState,
              connectionState: pc.connectionState,
              iceConnectionState: pc.iceConnectionState,
            });
          }).catch((error: any) => {
            console.error("[WebRTC] ⚠️ Error in setLocalDescription (non-fatal):", error);
            // Check if it was set despite the error
            if (pc.signalingState === "have-local-offer" || pc.localDescription) {
              console.log("[WebRTC] ⚠️ Local description appears to be set despite error");
            }
          });
          
          // Don't wait for setLocalDescription - proceed to send offer immediately
          // The offer SDP is already created and can be sent
          console.log("[WebRTC] Proceeding to send offer SDP without waiting for setLocalDescription...");
        } catch (error: any) {
          console.error("[WebRTC] ❌ Error creating offer:", error);
          console.error("[WebRTC] Error details:", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
          });
          throw error;
        }

        // CRITICAL: Send offer via WebSocket - this must happen!
        console.log("[WebRTC] ===== SENDING OFFER SDP =====");
        console.log("[WebRTC] About to check WebSocket - wsRef.current exists:", !!wsRef.current);
        console.log("[WebRTC] Checking WebSocket connection...");
        console.log("[WebRTC] wsRef.current:", wsRef.current);
        console.log("[WebRTC] wsRef.current type:", typeof wsRef.current);
        console.log("[WebRTC] WebSocket readyState:", wsRef.current?.readyState);
        console.log("[WebRTC] WebSocket states:", {
          CONNECTING: WebSocket.CONNECTING,
          OPEN: WebSocket.OPEN,
          CLOSING: WebSocket.CLOSING,
          CLOSED: WebSocket.CLOSED,
        });
        
        // Ensure WebSocket is connected before sending
        const ensureWebSocketConnected = async () => {
          let attempts = 0;
          const maxAttempts = 30; // 15 seconds total (increased from 10)
          while (attempts < maxAttempts) {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              console.log("[WebRTC] ✅ WebSocket is connected and OPEN");
              return true;
            }
            const state = wsRef.current?.readyState;
            const stateName = state === WebSocket.CONNECTING ? "CONNECTING" :
                            state === WebSocket.OPEN ? "OPEN" :
                            state === WebSocket.CLOSING ? "CLOSING" :
                            state === WebSocket.CLOSED ? "CLOSED" : "NULL/UNDEFINED";
            console.log(`[WebRTC] ⏳ Waiting for WebSocket (attempt ${attempts + 1}/${maxAttempts}), state: ${stateName} (${state})`);
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
          console.error("[WebRTC] ❌ WebSocket not connected after waiting 15 seconds");
          console.error("[WebRTC] Final wsRef.current:", wsRef.current);
          console.error("[WebRTC] Final readyState:", wsRef.current?.readyState);
          return false;
        };
        
        const isConnected = await ensureWebSocketConnected();
        if (!isConnected) {
          const errorMsg = `WebSocket not connected after 15 seconds. Current state: ${wsRef.current?.readyState ?? 'null'}`;
          console.error("[WebRTC] ❌", errorMsg);
          throw new Error(errorMsg);
        }
        
        // Send the offer
        console.log("[WebRTC] Sending offer via WebSocket...");
        const offerMessage = {
          type: "call.offer",
          call_id: call.id,
          call_type: type,
          offer: offer,
        };
        console.log("[WebRTC] Offer message:", { 
          type: offerMessage.type, 
          call_id: offerMessage.call_id, 
          call_type: offerMessage.call_type,
          offer_type: offer.type,
          offer_sdp_length: offer.sdp?.length 
        });
        
        try {
          const messageStr = JSON.stringify(offerMessage);
          console.log("[WebRTC] Sending offer message string (first 200 chars):", messageStr.substring(0, 200));
          wsRef.current!.send(messageStr);
          console.log("[WebRTC] ✅ Offer sent via WebSocket successfully");
          console.log("[WebRTC] WebSocket bufferedAmount after send:", wsRef.current!.bufferedAmount);
        } catch (error: any) {
          console.error("[WebRTC] ❌ Error sending offer:", error);
          console.error("[WebRTC] Error details:", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
          });
          throw new Error(`Failed to send offer: ${error.message}`);
        }

        setIsCallActive(true);
        console.log("[WebRTC] ✅ Call initiated successfully, returning call object");
        return call;
      } catch (error: any) {
        console.error("[WebRTC] ❌ Error initiating call:", error);
        console.error("[WebRTC] Error details:", {
          message: error?.message,
          stack: error?.stack,
          response: error?.response,
        });
        stopLocalStream();
        throw error;
      }
    },
    [conversationId, getLocalStream, createPeerConnection]
  );

  const answerCall = useCallback(
    async (call: any, type: "voice" | "video" = "voice") => {
      // Prevent duplicate calls
      if (isCallActive || currentCall) {
        console.warn("[WebRTC] ⚠️ Call already active, ignoring duplicate answerCall");
        return;
      }
      
      // Close any existing peer connection first
      if (peerConnectionRef.current) {
        console.log("[WebRTC] Closing existing peer connection before creating new one");
        try {
          peerConnectionRef.current.close();
        } catch (e) {
          console.warn("[WebRTC] Error closing existing peer connection:", e);
        }
        peerConnectionRef.current = null;
      }
      
      try {
        console.log("[WebRTC] answerCall called with:", { call, type });
        setCallType(type);
        setCurrentCall(call);
        
        // Get local media
        console.log("[WebRTC] Getting local media for answer...");
        const stream = await getLocalStream(type);
        console.log("[WebRTC] ✅ Local stream obtained for answer");
        console.log("[WebRTC] Stream tracks:", stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })));
        
        // Create peer connection
        console.log("[WebRTC] Creating peer connection for answer with stream...");
        const pc = createPeerConnection(stream); // Pass stream directly!
        console.log("[WebRTC] ✅ Peer connection created with tracks");
        console.log("[WebRTC] Peer connection state immediately after creation:", {
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
        });

        // Check peer connection is still open before proceeding
        console.log("[WebRTC] Checking peer connection state before API call...");
        console.log("[WebRTC] Peer connection state:", {
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
        });
        
        if (pc.signalingState === "closed") {
          console.error("[WebRTC] ❌ Peer connection was closed before API call!");
          throw new Error("Peer connection was closed unexpectedly");
        }

        // Accept call via API first
        console.log("[WebRTC] Accepting call via API...");
        await apiPost(`/calls/${call.id}/accept/`, {});
        console.log("[WebRTC] ✅ Call accepted via API");
        
        // Check peer connection again after API call - use ref to get current connection
        let activePc = peerConnectionRef.current || pc;
        console.log("[WebRTC] Checking peer connection state after API call...");
        console.log("[WebRTC] Peer connection state:", {
          signalingState: activePc.signalingState,
          connectionState: activePc.connectionState,
          iceConnectionState: activePc.iceConnectionState,
        });
        
        if (activePc.connectionState === "closed") {
          console.error("[WebRTC] ❌ Peer connection was closed after API call!");
          console.error("[WebRTC] This might be due to testing on localhost with a single device.");
          console.error("[WebRTC] Attempting to recreate peer connection...");
          const newPc = createPeerConnection(stream);
          // Update the ref
          peerConnectionRef.current = newPc;
          activePc = newPc;
          console.log("[WebRTC] ✅ Peer connection recreated");
        }

        // Wait for offer SDP if not already received
        let offerSDP = call.offer || pendingOfferSDP;
        if (!offerSDP) {
          console.log("[WebRTC] ⏳ Waiting for offer SDP from caller via WebSocket...");
          // Wait up to 15 seconds for the offer
          offerSDP = await new Promise<RTCSessionDescriptionInit>((resolve, reject) => {
            const timeout = setTimeout(() => {
              offerSDPResolverRef.current = null;
              reject(new Error("Timeout waiting for offer SDP from caller (15 seconds)"));
            }, 15000);
            
            // Store resolver so WebSocket handler or receiveOfferSDP can call it
            offerSDPResolverRef.current = (offer: RTCSessionDescriptionInit) => {
              clearTimeout(timeout);
              offerSDPResolverRef.current = null;
              resolve(offer);
            };
          });
          console.log("[WebRTC] ✅ Offer SDP received");
        } else {
          console.log("[WebRTC] ✅ Offer SDP already available");
          // Clear pending offer if we used it
          if (pendingOfferSDP) {
            setPendingOfferSDP(null);
          }
        }

        // Set remote description from offer FIRST (before creating answer)
        console.log("[WebRTC] Setting remote description from offer...");
        console.log("[WebRTC] Peer connection state before setRemoteDescription:", {
          signalingState: activePc.signalingState,
          connectionState: activePc.connectionState,
          iceConnectionState: activePc.iceConnectionState,
        });
        
        if (activePc.connectionState === "closed") {
          console.error("[WebRTC] ❌ Peer connection is closed, cannot set remote description");
          throw new Error("Peer connection was closed before setting remote description");
        }
        
        if (offerSDP) {
          try {
            await activePc.setRemoteDescription(new RTCSessionDescription(offerSDP));
            console.log("[WebRTC] ✅ Remote description set");
            console.log("[WebRTC] Peer connection state after setRemoteDescription:", {
              signalingState: activePc.signalingState,
              connectionState: activePc.connectionState,
              iceConnectionState: activePc.iceConnectionState,
            });
          } catch (error: any) {
            console.error("[WebRTC] ❌ Error setting remote description:", error);
            console.error("[WebRTC] Current peer connection state:", {
              signalingState: activePc.signalingState,
              connectionState: activePc.connectionState,
              iceConnectionState: activePc.iceConnectionState,
            });
            throw error;
          }
        } else {
          throw new Error("No offer SDP available");
        }

        // Create answer AFTER setting remote description
        console.log("[WebRTC] Creating answer...");
        const answer = await activePc.createAnswer();
        await activePc.setLocalDescription(answer);
        console.log("[WebRTC] ✅ Answer created and local description set");

        // Send answer via WebSocket
        console.log("[WebRTC] Sending answer via WebSocket...");
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "call.answer",
              call_id: call.id,
              answer: answer,
            })
          );
          console.log("[WebRTC] ✅ Answer sent via WebSocket");
        } else {
          console.warn("[WebRTC] ⚠️ WebSocket not connected, cannot send answer");
        }

        setIsCallActive(true);
        console.log("[WebRTC] ✅ Call answered successfully");
        onCallAccepted?.(call);
      } catch (error) {
        console.error("[WebRTC] ❌ Error answering call:", error);
        stopLocalStream();
        throw error;
      }
    },
    [getLocalStream, createPeerConnection, onCallAccepted, currentCall]
  );

  const endCall = useCallback(async () => {
    try {
      if (currentCall) {
        const duration = Math.floor(
          (Date.now() - new Date(currentCall.started_at).getTime()) / 1000
        );
        await apiPost(`/calls/${currentCall.id}/end/`, {
          duration_seconds: duration,
        });
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Stop local stream
      stopLocalStream();

      // Stop remote stream
      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
        setRemoteStream(null);
      }

      setIsCallActive(false);
      setCurrentCall(null);
      onCallEnded?.(currentCall);
    } catch (error) {
      console.error("Error ending call:", error);
    }
  }, [currentCall, remoteStream, onCallEnded]);

  const rejectCall = useCallback(async (callId: string) => {
    try {
      await apiPost(`/calls/${callId}/reject/`, {});
    } catch (error) {
      console.error("Error rejecting call:", error);
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, [localStream]);

  // Handle WebSocket messages for call signaling
  useEffect(() => {
    if (!wsRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "call.offer":
            // If this is an offer with SDP and we're waiting for it, resolve the promise
            if (data.offer && offerSDPResolverRef.current) {
              console.log("[WebRTC] ✅ Received offer SDP via WebSocket, resolving wait");
              offerSDPResolverRef.current(data.offer);
            }
            break;

          case "call.answer":
            if (peerConnectionRef.current && data.answer) {
              peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription(data.answer)
              ).catch((error) => {
                console.error("Error setting remote description:", error);
              });
            }
            break;

          case "call.ice-candidate":
            if (peerConnectionRef.current && data.candidate) {
              peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(data.candidate)
              ).catch((error) => {
                console.error("Error adding ICE candidate:", error);
              });
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
  }, [wsRef.current]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocalStream();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [stopLocalStream]);

  const receiveOfferSDP = useCallback((offer: RTCSessionDescriptionInit) => {
    console.log("[WebRTC] receiveOfferSDP called with offer:", offer);
    if (offerSDPResolverRef.current) {
      console.log("[WebRTC] ✅ Resolving waiting promise with offer SDP");
      offerSDPResolverRef.current(offer);
      offerSDPResolverRef.current = null;
    } else {
      console.log("[WebRTC] ⚠️ No resolver waiting, storing offer SDP");
      setPendingOfferSDP(offer);
    }
  }, []);

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
    setWebSocket: (ws: WebSocket) => {
      // Only update if it's different to prevent spam
      if (wsRef.current === ws) {
        return; // Already set, skip
      }
      console.log("[WebRTC] setWebSocket called, readyState:", ws?.readyState);
      wsRef.current = ws;
      console.log("[WebRTC] ✅ WebSocket ref updated");
    },
  };
}

