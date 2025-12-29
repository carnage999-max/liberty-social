import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCall } from '../contexts/CallContext';

export function useWebSocket() {
  const { accessToken, isAuthenticated } = useAuth();
  const { setWebSocket } = useCall();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let shouldReconnect = true;

    const getWebSocketUrl = () => {
      // Get the backend URL from environment
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      // Convert http/https to ws/wss
      const wsUrl = backendUrl
        .replace(/^https:/, 'wss:')
        .replace(/^http:/, 'ws:')
        .replace(/\/$/, ''); // Remove trailing slash
      return `${wsUrl}/ws/notifications/`;
    };

    const connect = () => {
      try {
        const wsUrl = getWebSocketUrl();
        console.log('[WebSocket] Connecting to:', wsUrl);

        ws = new WebSocket(wsUrl, ['token', accessToken]);

        ws.onopen = () => {
          console.log('[WebSocket] Connected');
          setWebSocket(ws);
        };

        ws.onmessage = (event) => {
          console.log('[WebSocket] Message received:', event.data);
          try {
            const data = JSON.parse(event.data);
            // Message handling is done in CallContext
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        };

        ws.onerror = (error) => {
          console.warn('[WebSocket] Connection error (backend may be unavailable). Will retry in 5s...');
        };

        ws.onclose = () => {
          console.log('[WebSocket] Disconnected');
          setWebSocket(null);

          // Attempt to reconnect after 5 seconds
          if (shouldReconnect) {
            reconnectTimeout = setTimeout(() => {
              console.log('[WebSocket] Attempting to reconnect...');
              connect();
            }, 5000);
          }
        };
      } catch (error) {
        console.warn('[WebSocket] Connection error (backend may be unavailable). Will retry in 5s...');

        // Retry connection after 5 seconds
        if (shouldReconnect) {
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 5000);
        }
      }
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, [isAuthenticated, accessToken, setWebSocket]);
}
