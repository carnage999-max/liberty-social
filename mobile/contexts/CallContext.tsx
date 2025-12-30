import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { apiClient } from '../utils/api';
import { User } from '../types';

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

  // TODO: Integrate with existing chat WebSocket for call signaling
  // For now, calls can be initiated via REST API

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

        // Set timeout for ringing (30 seconds)
        if (callTimerRef.current) clearTimeout(callTimerRef.current);
        callTimerRef.current = setTimeout(() => {
          console.log('[CallContext] Call timeout - no answer');
          setOutgoingCall(null);
          showToast('Call ended • No answer', 'info', 3000);
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
      // Capture current call state at the time this function is called
      const call = activeCall || outgoingCall;
      if (!call) {
        console.log('[CallContext] No active or outgoing call to end');
        return;
      }

      console.log('[CallContext] Ending call:', call.id);

      // Clear any pending timers
      if (callTimerRef.current) {
        clearTimeout(callTimerRef.current);
        callTimerRef.current = null;
      }

      const duration = Math.floor(
        (Date.now() - new Date(call.started_at).getTime()) / 1000
      );

      try {
        await apiClient.post(`/calls/${call.id}/end/`, {
          duration_seconds: duration,
        });
      } catch (apiError) {
        console.warn('[CallContext] API error ending call (call may not exist yet):', apiError);
        // Continue anyway - clear local state
      }

      setActiveCall(null);
      setOutgoingCall(null);
      setIncomingCall(null);

      // TODO: Send end notification via WebSocket when integrated
    } catch (error) {
      console.error('[CallContext] Error ending call:', error);
      // Still clear the call state even if there's an error
      setActiveCall(null);
      setOutgoingCall(null);
      setIncomingCall(null);
      throw error;
    }
  }, [activeCall, outgoingCall]);

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
