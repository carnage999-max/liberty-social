"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useGlobalNotificationWebSocket } from "@/hooks/useGlobalNotificationWebSocket";
import IncomingCallModal from "@/components/calls/IncomingCallModal";
import OutgoingCallModal from "@/components/calls/OutgoingCallModal";
import ActiveCallModal from "@/components/calls/ActiveCallModal";
import { apiGet } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useFeedBackground } from "@/hooks/useFeedBackground";

interface CallContextType {
  incomingCall: any | null;
  activeCall: any | null;
  outgoingCall: any | null;
  initiateCall: (receiverId: string, type: "voice" | "video", conversationId?: string) => Promise<void>;
  answerCall: (call: any) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  webrtc: ReturnType<typeof useWebRTC>;
  setWebSocket: (ws: WebSocket | null) => void;
  setConversation: (conv: any) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const toast = useToast();
  const { theme: chatBackground } = useFeedBackground();
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<any | null>(null);
  const [conversation, setConversationState] = useState<any | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const conversationRef = useRef<any | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  // Initialize WebRTC hook (must come before using it)
  const webrtc = useWebRTC({
    onCallIncoming: (call) => {
      console.log("[CallContext] onCallIncoming:", call);
      setIncomingCall(call);
    },
    onCallAccepted: (call) => {
      console.log("[CallContext] onCallAccepted:", call);
      setIncomingCall(null);
      setOutgoingCall(null);
      setActiveCall(call);
    },
    onCallEnded: (call) => {
      console.log("[CallContext] onCallEnded:", call);
      setIncomingCall(null);
      setActiveCall(null);
      setOutgoingCall(null);
    },
  });

  // Connect to global notification WebSocket for incoming calls
  const globalWsRef = useRef<WebSocket | null>(null);

  useGlobalNotificationWebSocket({
    onCallIncoming: (data) => {
      console.log("[CallContext] 📞 Global incoming call notification:", data);
      // Dispatch as a custom event so existing handlers can process it
      window.dispatchEvent(new CustomEvent("call.message", { detail: data }));
    },
    onWebSocketReady: (ws) => {
      console.log("[CallContext] Global notification WebSocket ready, setting as fallback for WebRTC");
      globalWsRef.current = ws;
      // If no chat WebSocket is set, use the global WebSocket for signaling
      if (!wsRef.current) {
        console.log("[CallContext] No chat WebSocket, using global WebSocket for call signaling");
        webrtc.setWebSocket(ws);
      }
    },
  });

  // Set WebSocket reference (for chat WebSocket)
  const setWebSocket = useCallback((ws: WebSocket | null) => {
    console.log("[CallContext] Setting chat WebSocket for call signaling");
    wsRef.current = ws;
    if (ws) {
      webrtc.setWebSocket(ws);
    } else if (globalWsRef.current) {
      // If chat WebSocket is removed, fall back to global WebSocket
      console.log("[CallContext] Chat WebSocket removed, falling back to global WebSocket");
      webrtc.setWebSocket(globalWsRef.current);
    }
  }, [webrtc]);

  // Set conversation
  const setConversation = useCallback((conv: any) => {
    conversationRef.current = conv;
    setConversationState(conv);
  }, []);

  // Handle WebSocket messages for calls - listen to global events
  useEffect(() => {
    if (!user) return;

    const handleCallMessage = (event: CustomEvent) => {
      const data = event.detail;
      console.log("[CallContext] Received call message event:", data.type);

      switch (data.type) {
        case "call.incoming":
          console.log("[CallContext] Incoming call received:", data);
          if (data.caller_id !== user.id.toString()) {
            setIncomingCall({
              id: data.call_id,
              caller_id: data.caller_id,
              caller_username: data.caller_username,
              call_type: data.call_type,
              offer: data.offer,
              conversation_id: data.conversation_id,
            });
          }
          break;

        case "call.offer":
          console.log("[CallContext] Call offer received:", data);
          if (data.caller_id !== user.id.toString()) {
            // This is for the receiver - treat as incoming call if we don't have one yet
            if (!incomingCall || incomingCall.id !== data.call_id) {
              console.log("[CallContext] New incoming call from offer, setting incoming call state");
              setIncomingCall({
                id: data.call_id,
                caller_id: data.caller_id,
                caller_username: data.caller_username || "Unknown",
                call_type: data.call_type || "voice",
                offer: data.offer,
                conversation_id: data.conversation_id,
              });
            }
            // Notify WebRTC hook if offer SDP is present (simple-peer will handle it)
            if (data.offer) {
              console.log("[CallContext] Offer SDP present and we are the receiver, notifying WebRTC hook");
              webrtc.receiveOfferSDP(data.offer);
            }
          } else {
            console.log("[CallContext] Offer from ourselves, ignoring (we sent this)");
          }
          break;

        case "call.answer":
          console.log("[CallContext] Call answer received:", data);
          // If we have an outgoing call, transition to active
          if (outgoingCall && data.call_id === outgoingCall.id.toString()) {
            console.log("[CallContext] Answer received for outgoing call, transitioning to active");
            setActiveCall(outgoingCall);
            setOutgoingCall(null);
          }
          // Only pass answer SDP to WebRTC hook if we are the CALLER (not the receiver)
          // The receiver sent this answer, so they shouldn't process it themselves
          // receiver_id in the answer message is the person who answered (the receiver)
          // So if receiver_id !== user.id, then WE are the caller
          if (data.answer && data.receiver_id !== user.id.toString() && webrtc.receiveAnswerSDP) {
            console.log("[CallContext] Answer SDP present and we are the caller, notifying WebRTC hook");
            webrtc.receiveAnswerSDP(data.answer);
          } else if (data.answer && data.receiver_id === user.id.toString()) {
            console.log("[CallContext] Answer SDP present but we are the receiver, ignoring (we sent this)");
          }
          break;

        case "call.accepted":
          console.log("[CallContext] Call accepted notification:", data);
          if (outgoingCall && data.call_id === outgoingCall.id.toString()) {
            setActiveCall(outgoingCall);
            setOutgoingCall(null);
          }
          break;

        case "call.ended":
        case "call.end":
          console.log("[CallContext] Call ended notification:", data);
          setIncomingCall(null);
          setActiveCall(null);
          setOutgoingCall(null);
          // Also call endCall to clean up WebRTC resources
          if (webrtc.isCallActive || activeCall) {
            webrtc.endCall().catch((err) => {
              console.error("[CallContext] Error ending call:", err);
            });
          }
          break;
      }
    };

    window.addEventListener("call.message" as any, handleCallMessage as EventListener);

    return () => {
      window.removeEventListener("call.message" as any, handleCallMessage as EventListener);
    };
  }, [user, incomingCall, outgoingCall, webrtc]);

  const initiateCall = useCallback(
    async (receiverId: string, type: "voice" | "video" = "voice", conversationId?: string) => {
      try {
        if (conversationId) {
          conversationIdRef.current = conversationId;
        }
        
        // Set outgoing call immediately to show UI
        setOutgoingCall({
          id: "pending",
          receiver_id: receiverId,
          receiver_username: "User", // Will be updated when call is created
          call_type: type,
          conversation_id: conversationId,
        });
        
        const call = await webrtc.initiateCall(receiverId, type, conversationId);
        
        // Update with real call data
        setOutgoingCall({
          id: call.id,
          receiver_id: receiverId,
          receiver_username: call.receiver_username || call.receiver?.username || "User",
          call_type: type,
          conversation_id: conversationId,
        });
      } catch (error: any) {
        console.error("[CallContext] Error initiating call:", error);
        setOutgoingCall(null); // Clear on error
        throw error;
      }
    },
    [webrtc]
  );

  const answerCall = useCallback(
    async (call: any) => {
      try {
        await webrtc.answerCall(call, call.call_type || "voice");
        setIncomingCall(null);
        setActiveCall(call);
      } catch (error: any) {
        console.error("[CallContext] Error answering call:", error);
        throw error;
      }
    },
    [webrtc]
  );

  const rejectCall = useCallback(
    async (callId: string) => {
      try {
        await webrtc.rejectCall(callId);
        setIncomingCall(null);
      } catch (error) {
        console.error("[CallContext] Error rejecting call:", error);
      }
    },
    [webrtc]
  );

  const endCall = useCallback(async () => {
    try {
      await webrtc.endCall();
      setActiveCall(null);
      setOutgoingCall(null);
      setIncomingCall(null);
    } catch (error) {
      console.error("[CallContext] Error ending call:", error);
    }
  }, [webrtc]);

  // Get participant info for modals
  const getCallerParticipant = () => {
    const conv = conversationRef.current || conversation;
    if (!conv || !incomingCall) return null;
    return conv.participants.find(
      (p: any) => p.user.id.toString() === incomingCall.caller_id
    );
  };

  const getReceiverParticipant = () => {
    const conv = conversationRef.current || conversation;
    if (!conv || !outgoingCall) return null;
    return conv.participants.find(
      (p: any) => p.user.id.toString() === outgoingCall.receiver_id
    );
  };

  const getOtherParticipant = () => {
    const conv = conversationRef.current || conversation;
    if (!conv || !activeCall) return null;
    return conv.participants.find((p: any) => p.user.id !== user?.id);
  };

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
        webrtc,
        setWebSocket,
        setConversation,
      }}
    >
      {children}

      {/* Incoming Call Modal - Global */}
      {incomingCall && (() => {
        const callerParticipant = getCallerParticipant();
        return (
          <IncomingCallModal
            call={incomingCall}
            onAccept={async () => {
              if (webrtc.isCallActive || activeCall) {
                console.log("[CallContext] Call already active, ignoring accept");
                return;
              }
              try {
                await answerCall(incomingCall);
              } catch (error: any) {
                console.error("[CallContext] Error answering call:", error);
              }
            }}
            onReject={async () => {
              await rejectCall(incomingCall.id);
            }}
            callerAvatar={callerParticipant?.user.profile_image_url || undefined}
          />
        );
      })()}

      {/* Outgoing Call Modal - Global */}
      {outgoingCall && (() => {
        const receiverParticipant = getReceiverParticipant();
        return (
          <OutgoingCallModal
            call={{
              id: outgoingCall.id?.toString() || "",
              receiver_id: outgoingCall.receiver_id,
              receiver_username: outgoingCall.receiver_username,
              call_type: outgoingCall.call_type || "voice",
            }}
            onCancel={async () => {
              await endCall();
            }}
            receiverAvatar={receiverParticipant?.user.profile_image_url || undefined}
          />
        );
      })()}

      {/* Active Call Modal - Global */}
      {activeCall && (() => {
        const otherParticipant = getOtherParticipant();
        if (!otherParticipant) return null;

        const handleCallEnded = (durationSeconds: number) => {
          const mins = Math.floor(durationSeconds / 60);
          const secs = durationSeconds % 60;
          const durationText = mins > 0
            ? `${mins} minute${mins > 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`
            : `${secs} second${secs !== 1 ? 's' : ''}`;

          toast.show(`Call ended. Duration: ${durationText}`, "success", 5000);
        };

        return (
          <ActiveCallModal
            call={activeCall}
            otherUser={{
              id: otherParticipant.user.id.toString(),
              username: otherParticipant.user.username || otherParticipant.user.first_name || "User",
              avatar: otherParticipant.user.profile_image_url || undefined,
            }}
            onEndCall={endCall}
            isVideoCall={activeCall.call_type === "video"}
            localVideoRef={webrtc.localVideoRef as React.RefObject<HTMLVideoElement>}
            remoteVideoRef={webrtc.remoteVideoRef as React.RefObject<HTMLVideoElement>}
            localStream={webrtc.localStream}
            remoteStream={webrtc.remoteStream}
            endCall={endCall}
            chatBackground={chatBackground}
            onCallEnded={handleCallEnded}
          />
        );
      })()}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}

