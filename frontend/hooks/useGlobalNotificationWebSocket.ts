"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface UseGlobalNotificationWebSocketOptions {
  onCallIncoming?: (data: any) => void;
  onNotificationCreated?: (data: any) => void;
  onWebSocketReady?: (ws: WebSocket) => void;
}

// Singleton WebSocket instance to prevent multiple connections
let globalWsInstance: WebSocket | null = null;
let globalWsToken: string | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
let refCount = 0; // Track how many components are using the connection

export function useGlobalNotificationWebSocket(
  options: UseGlobalNotificationWebSocketOptions = {}
) {
  const { accessToken } = useAuth();
  const { onCallIncoming, onNotificationCreated, onWebSocketReady } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const isMountedRef = useRef(true);

  // Use refs to store callbacks to avoid recreating connect() on every render
  const onCallIncomingRef = useRef(onCallIncoming);
  const onNotificationCreatedRef = useRef(onNotificationCreated);
  const onWebSocketReadyRef = useRef(onWebSocketReady);

  // Update refs when callbacks change
  useEffect(() => {
    onCallIncomingRef.current = onCallIncoming;
    onNotificationCreatedRef.current = onNotificationCreated;
    onWebSocketReadyRef.current = onWebSocketReady;
  }, [onCallIncoming, onNotificationCreated, onWebSocketReady]);

  const connect = useCallback(() => {
    if (!accessToken) return;

    // If we already have a connection with the same token, reuse it
    if (globalWsInstance && globalWsToken === accessToken) {
      const state = globalWsInstance.readyState;
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        console.log("[GlobalNotificationWS] Reusing existing connection, refCount:", refCount);
        wsRef.current = globalWsInstance;
        setIsConnected(state === WebSocket.OPEN);
        return;
      }
    }

    // Increment reference count only when creating a new connection
    refCount++;
    console.log("[GlobalNotificationWS] Incrementing refCount to:", refCount);

    // Close any existing connection if token changed
    if (globalWsInstance && globalWsToken !== accessToken) {
      console.log("[GlobalNotificationWS] Token changed, closing old connection");
      globalWsInstance.close();
      globalWsInstance = null;
      globalWsToken = null;
    }

    // Prevent duplicate connections
    if (globalWsInstance && (globalWsInstance.readyState === WebSocket.CONNECTING || globalWsInstance.readyState === WebSocket.OPEN)) {
      console.log("[GlobalNotificationWS] Connection already exists, skipping");
      wsRef.current = globalWsInstance;
      return;
    }

    // Use the WebSocket base URL from environment variable
    const wsBase = process.env.NEXT_PUBLIC_WS_BASE_URL || "ws://localhost:8000";
    const wsUrl = `${wsBase}/ws/notifications/?token=${accessToken}`;

    console.log("[GlobalNotificationWS] Creating new connection");

    const ws = new WebSocket(wsUrl);
    globalWsInstance = ws;
    globalWsToken = accessToken;
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[GlobalNotificationWS] ✅ Connected");
      if (isMountedRef.current) {
        setIsConnected(true);
      }
      reconnectAttempts = 0;

      // Notify callback that WebSocket is ready
      if (onWebSocketReadyRef.current) {
        onWebSocketReadyRef.current(ws);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[GlobalNotificationWS] Received:", data.type);

        // Handle all call-related messages
        if (data.type?.startsWith("call.")) {
          console.log("[GlobalNotificationWS] 📞 Call message:", data.type, data);
          // Dispatch as custom event for CallContext to handle
          window.dispatchEvent(new CustomEvent("call.message", { detail: data }));

          // Also trigger the callback for backward compatibility
          if (data.type === "call.incoming") {
            onCallIncomingRef.current?.(data);
          }
        } else if (data.type === "notification.created") {
          console.log("[GlobalNotificationWS] 🔔 New notification");
          onNotificationCreatedRef.current?.(data.payload);
        } else if (data.type === "connection.ack") {
          console.log("[GlobalNotificationWS] Connection acknowledged");
        } else if (data.type === "pong") {
          // Heartbeat response
        }
      } catch (error) {
        console.error("[GlobalNotificationWS] Error parsing message:", error);
      }
    };

    ws.onerror = () => {
      console.warn("[GlobalNotificationWS] Connection error");
    };

    ws.onclose = (event) => {
      console.log("[GlobalNotificationWS] Disconnected", event.code);
      if (isMountedRef.current) {
        setIsConnected(false);
      }

      // Clear global instance if this is the current one
      if (globalWsInstance === ws) {
        globalWsInstance = null;
        globalWsToken = null;
      }
      wsRef.current = null;

      // Attempt to reconnect with exponential backoff
      if (reconnectAttempts < maxReconnectAttempts && event.code !== 1000) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`[GlobalNotificationWS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);

        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }

        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++;
          connect();
        }, delay);
      }
    };

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeat);
    };
  }, [accessToken]); // Removed callback dependencies since we use refs now

  useEffect(() => {
    if (!accessToken) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const cleanup = connect();

    return () => {
      // Decrement reference count
      refCount--;
      console.log(`[GlobalNotificationWS] Cleanup called, refCount: ${refCount}`);

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      // Only close the global WebSocket if no other components are using it
      if (refCount <= 0 && wsRef.current) {
        console.log("[GlobalNotificationWS] Last reference removed, closing connection");
        wsRef.current.close();
        wsRef.current = null;
        globalWsInstance = null;
        globalWsToken = null;
        refCount = 0; // Reset to 0
      } else {
        console.log("[GlobalNotificationWS] Other components still using connection, keeping alive");
      }

      cleanup?.();
    };
  }, [accessToken, connect]);

  return {
    isConnected,
    ws: wsRef.current,
  };
}
