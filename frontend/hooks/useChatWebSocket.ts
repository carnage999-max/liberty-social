"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api";
import type { Message } from "@/lib/types";

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
  const { accessToken } = useAuth();
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

  const connect = useCallback(() => {
    if (!enabledRef.current || !conversationId || !accessToken) return;

    try {
      // Construct WebSocket URL
      const wsBase = API_BASE.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
      const wsUrl = `${wsBase.replace("/api", "")}/ws/chat/${conversationId}/?token=${accessToken}`;

      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WebSocket] Connected to conversation", conversationId);
        setIsConnected(true);
        setReconnectAttempts(0);
        onConnect?.();

        // Start ping interval (every 30 seconds)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connection.ack") {
            console.log("[WebSocket] Connection acknowledged");
          } else if (data.type === "message.created") {
            const message = data.payload as Message;
            onMessage?.(message);
          } else if (data.type === "message.updated") {
            const message = data.payload as Message;
            window.dispatchEvent(new CustomEvent("message.updated", { detail: message }));
          } else if (data.type === "message.deleted") {
            const message = data.payload as Message;
            window.dispatchEvent(new CustomEvent("message.deleted", { detail: message }));
          } else if (data.type === "pong") {
            // Heartbeat response
          }
        } catch (error) {
          console.error("[WebSocket] Error parsing message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        onError?.(new Error("WebSocket connection error"));
      };

      ws.onclose = (event) => {
        console.log("[WebSocket] Disconnected", event.code, event.reason);
        setIsConnected(false);
        onDisconnect?.();

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect if enabled and not a normal closure
        if (
          enabledRef.current &&
          event.code !== 1000 &&
          reconnectAttempts < 5
        ) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(
            `[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[WebSocket] Failed to connect:", error);
      onError?.(error as Error);
    }
  }, [conversationId, accessToken, onMessage, onError, onConnect, onDisconnect, reconnectAttempts]);

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
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled && conversationId && accessToken) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, conversationId, accessToken, connect, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
  };
}

