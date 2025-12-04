import { useEffect, useRef, useState, useCallback } from 'react';
import { storage } from '../utils/storage';
import { getApiBase } from '../constants/API';
import { Message } from '../types';

interface UseChatWebSocketOptions {
  conversationId: string | number;
  enabled?: boolean;
  onMessage?: (message: Message) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useChatWebSocket({
  conversationId,
  enabled = true,
  onMessage,
  onError,
  onConnect,
  onDisconnect,
}: UseChatWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const enabledRef = useRef(enabled);

  // Update enabled ref when it changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const connect = useCallback(async () => {
    if (!enabledRef.current || !conversationId) return;

    try {
      // Get access token
      const token = await storage.getAccessToken();
      if (!token) {
        console.warn('[WebSocket] No access token available');
        return;
      }

      // Construct WebSocket URL - match frontend implementation
      const apiBase = getApiBase();
      // Convert HTTP/HTTPS to WS/WSS and remove /api suffix
      let wsBase = apiBase.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
      wsBase = wsBase.replace(/\/api$/, ''); // Match frontend: only replace /api at the end
      // Don't URL encode - backend expects raw token in query string (matches frontend)
      const wsUrl = `${wsBase}/ws/chat/${conversationId}/?token=${token}`;

      console.log('[WebSocket] Connecting to:', wsUrl.replace(/token=[^&]+/, 'token=***'));
      console.log('[WebSocket] Token length:', token.length);

      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebSocket] Connected to conversation', conversationId);
        setIsConnected(true);
        setReconnectAttempts(0);
        onConnect?.();

        // Start ping interval (every 30 seconds)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connection.ack') {
            console.log('[WebSocket] Connection acknowledged');
          } else if (data.type === 'message.created') {
            const message = data.payload as Message;
            onMessage?.(message);
          } else if (data.type === 'pong') {
            // Heartbeat response
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        // Silently handle errors - polling will be used as fallback
        console.log('[WebSocket] Connection error, will use polling fallback');
        onError?.(new Error('WebSocket connection error'));
      };

      ws.onclose = (event) => {
        const closeCode = event.code;
        const closeReason = event.reason || 'No reason provided';
        
        // Only log non-normal closures for debugging
        if (event.code !== 1000) {
        console.log('[WebSocket] Disconnected', {
          code: closeCode,
          reason: closeReason,
          conversationId,
          wasClean: event.wasClean,
        });
        }
        
        // Log specific error codes only for debugging (not as errors)
        if (closeCode === 4401) {
          console.log('[WebSocket] Authentication failed (401) - using polling fallback');
        } else if (closeCode === 4403) {
          console.log('[WebSocket] Access denied (403) - using polling fallback');
        } else if (closeCode === 4400) {
          console.log('[WebSocket] Bad request (400) - using polling fallback');
        } else if (closeCode === 1006) {
          console.log('[WebSocket] Connection lost - using polling fallback');
        }
        
        setIsConnected(false);
        onDisconnect?.();

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect if enabled and not a normal closure
        if (enabledRef.current && event.code !== 1000 && reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      onError?.(error as Error);
    }
  }, [conversationId, onMessage, onError, onConnect, onDisconnect, reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled && conversationId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, conversationId, connect, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
  };
}

