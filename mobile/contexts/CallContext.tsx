import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { apiClient } from '../utils/api';

interface Call {
  id: number;
  caller_id: string | number;
  caller_username: string;
  receiver_id: string | number;
  receiver_username: string;
  call_type: 'voice' | 'video';
  status: 'initiating' | 'ringing' | 'active' | 'ended' | 'missed' | 'rejected' | 'cancelled';
  conversation_id?: number;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration_seconds?: number;
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
  ws: WebSocket | null;
  setWebSocket: (ws: WebSocket | null) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<Call | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Setup WebSocket listener for incoming calls
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'call.incoming') {
          console.log('[CallContext] Incoming call:', data);
          setIncomingCall({
            id: data.call_id,
            caller_id: data.caller_id,
            caller_username: data.caller_username,
            receiver_id: user?.id || '0',
            receiver_username: user?.username || '',
            call_type: data.call_type,
            status: 'ringing',
            conversation_id: data.conversation_id,
            started_at: new Date().toISOString(),
          });
        } else if (data.type === 'call.accepted') {
          console.log('[CallContext] Call accepted:', data);
          setOutgoingCall(null);
          if (outgoingCall) {
            setActiveCall({
              ...outgoingCall,
              status: 'active',
              answered_at: new Date().toISOString(),
            });
          }
        } else if (data.type === 'call.rejected') {
          console.log('[CallContext] Call rejected:', data);
          setOutgoingCall(null);
        } else if (data.type === 'call.ended') {
          console.log('[CallContext] Call ended:', data);
          setActiveCall(null);
          setIncomingCall(null);
        }
      } catch (error) {
        console.error('[CallContext] Error parsing WebSocket message:', error);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, outgoingCall, user?.id, user?.username]);

  const initiateCall = useCallback(
    async (receiverId: number, callType: 'voice' | 'video', conversationId?: number) => {
      try {
        console.log('[CallContext] Initiating call:', { receiverId, callType, conversationId });

        // Set outgoing call state immediately
        setOutgoingCall({
          id: 0,
          caller_id: user?.id || '0',
          caller_username: user?.username || '',
          receiver_id: receiverId,
          receiver_username: '',
          call_type: callType,
          status: 'initiating',
          conversation_id: conversationId,
          started_at: new Date().toISOString(),
        });

        // Call backend to initiate
        const response = await apiClient.post<Call>('/calls/initiate/', {
          receiver_id: receiverId,
          call_type: callType,
          conversation_id: conversationId,
        });

        console.log('[CallContext] Call initiated:', response);

        setOutgoingCall({
          ...response,
          caller_username: user?.username || '',
        });

        // Set timeout for ringing (30 seconds)
        if (callTimerRef.current) clearTimeout(callTimerRef.current);
        callTimerRef.current = setTimeout(() => {
          console.log('[CallContext] Call timeout - no answer');
          setOutgoingCall(null);
        }, 30000);
      } catch (error) {
        console.error('[CallContext] Error initiating call:', error);
        setOutgoingCall(null);
        throw error;
      }
    },
    [user?.id, user?.username]
  );

  const answerCall = useCallback(
    async (callId: number) => {
      try {
        console.log('[CallContext] Answering call:', callId);

        const response = await apiClient.post<Call>(`/calls/${callId}/accept/`, {});

        console.log('[CallContext] Call answered:', response);

        setIncomingCall(null);
        setActiveCall(response);

        // Send answer via WebSocket
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'call.answer',
              call_id: callId,
              receiver_id: user?.id,
            })
          );
        }
      } catch (error) {
        console.error('[CallContext] Error answering call:', error);
        throw error;
      }
    },
    [ws, user?.id]
  );

  const rejectCall = useCallback(
    async (callId: number) => {
      try {
        console.log('[CallContext] Rejecting call:', callId);

        await apiClient.post(`/calls/${callId}/reject/`, {});

        setIncomingCall(null);
      } catch (error) {
        console.error('[CallContext] Error rejecting call:', error);
        throw error;
      }
    },
    []
  );

  const endCall = useCallback(async () => {
    try {
      if (!activeCall) return;

      console.log('[CallContext] Ending call:', activeCall.id);

      const duration = Math.floor(
        (Date.now() - new Date(activeCall.started_at).getTime()) / 1000
      );

      await apiClient.post(`/calls/${activeCall.id}/end/`, {
        duration_seconds: duration,
      });

      setActiveCall(null);
      setIncomingCall(null);

      // Send end notification via WebSocket
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'call.end',
            call_id: activeCall.id,
          })
        );
      }
    } catch (error) {
      console.error('[CallContext] Error ending call:', error);
      throw error;
    }
  }, [activeCall, ws]);

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
        ws,
        setWebSocket: setWs,
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
