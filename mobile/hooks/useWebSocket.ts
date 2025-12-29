import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCall } from '../contexts/CallContext';

const WS_URL = process.env.EXPO_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000/ws/notifications/';

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

    const connect = () => {
      try {
        console.log('[WebSocket] Connecting to:', WS_URL);

        ws = new WebSocket(WS_URL, ['token', accessToken]);

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
          console.error('[WebSocket] Error:', error);
        };

        ws.onclose = () => {
          console.log('[WebSocket] Disconnected');
          setWebSocket(null);

          // Attempt to reconnect after 3 seconds
          if (shouldReconnect) {
            reconnectTimeout = setTimeout(() => {
              console.log('[WebSocket] Attempting to reconnect...');
              connect();
            }, 3000);
          }
        };
      } catch (error) {
        console.error('[WebSocket] Connection error:', error);

        // Retry connection after 3 seconds
        if (shouldReconnect) {
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
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
