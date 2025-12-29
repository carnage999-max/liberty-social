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

}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<Call | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // TODO: Integrate with existing chat WebSocket for call signaling
  // For now, calls can be initiated via REST API

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

        // TODO: Send answer via WebSocket when integrated
      } catch (error) {
        console.error('[CallContext] Error answering call:', error);
        throw error;
      }
    },
    []
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

      // TODO: Send end notification via WebSocket when integrated
    } catch (error) {
      console.error('[CallContext] Error ending call:', error);
      throw error;
    }
  }, [activeCall]);

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
