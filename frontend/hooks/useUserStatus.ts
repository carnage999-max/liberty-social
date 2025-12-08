'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { API_BASE } from '@/lib/api';

interface UserStatusEvent {
  type: 'user.status.changed';
  user_id: string;
  is_online: boolean;
}

type StatusChangeCallback = (event: UserStatusEvent) => void;

/**
 * Hook to manage WebSocket connection for user online status tracking
 *
 * Automatically connects when user is authenticated and disconnects on logout.
 * Reconnects automatically if connection drops.
 *
 * Usage:
 * ```tsx
 * useUserStatus((event) => {
 *   console.log(`User ${event.user_id} is now ${event.is_online ? 'online' : 'offline'}`);
 * });
 * ```
 */
export function useUserStatus(onStatusChange?: StatusChangeCallback) {
  const { user, accessToken } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  const connect = useCallback(() => {
    // Don't try to connect if not authenticated
    if (!user || !accessToken) {
      return;
    }

    // Prevent multiple connections
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Use API_BASE to construct WebSocket URL (same as chat WebSocket)
      // Convert https:// to wss:// and http:// to ws://
      let wsBase = API_BASE.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
      // Remove trailing /api if present
      wsBase = wsBase.replace(/\/api\/?$/, "");
      const wsUrl = `${wsBase}/ws/user-status/?token=${accessToken}`;

      console.log('[UserStatus] Connecting to WebSocket:', wsUrl.replace(/token=[^&]+/, 'token=***'));
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[UserStatus] Connected to WebSocket');
        reconnectAttemptsRef.current = 0;

        // Send initial ping to establish connection
        ws.send(JSON.stringify({ type: 'ping' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connection.ack') {
            console.log('[UserStatus] Connection acknowledged');
          } else if (data.type === 'user.status.changed' && onStatusChange) {
            onStatusChange(data as UserStatusEvent);
          }
        } catch (err) {
          console.error('[UserStatus] Error parsing message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[UserStatus] WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('[UserStatus] Connection closed', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current += 1;
          console.log(`[UserStatus] Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.warn('[UserStatus] Max reconnect attempts reached');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[UserStatus] Error connecting to WebSocket:', error);
    }
  }, [user, accessToken, onStatusChange]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  // Connect on mount when authenticated
  useEffect(() => {
    if (user && accessToken) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      // Cleanup on unmount - but don't disconnect to keep status updates flowing
      // Only clear the timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user, accessToken, connect, disconnect]);

  // Send periodic pings to keep connection alive and update activity
  useEffect(() => {
    const interval = setInterval(() => {
      sendPing();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [sendPing]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    sendPing,
    disconnect,
  };
}
