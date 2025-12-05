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
  onTypingStart?: (userId: string, username: string) => void;
  onTypingStop?: (userId: string, username: string) => void;
}

export function useChatWebSocket({
  conversationId,
  enabled = true,
  onMessage,
  onError,
  onConnect,
  onDisconnect,
  onTypingStart,
  onTypingStop,
}: UseChatWebSocketOptions) {
  const { accessToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const enabledRef = useRef(enabled);
  const isConnectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update enabled ref when it changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const connect = useCallback(() => {
    if (!enabledRef.current || !conversationId || !accessToken) return;

    try {
      // Construct WebSocket URL
      const wsBase = API_BASE.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
      const wsUrl = `${wsBase.replace(/\/api$/, "")}/ws/chat/${conversationId}/?token=${accessToken}`;

      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WebSocket] Connected to conversation", conversationId);
        setIsConnected(true);
        isConnectedRef.current = true;
        reconnectAttemptsRef.current = 0;
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
          } else if (data.type === "typing.started") {
            onTypingStart?.(data.user_id, data.username);
          } else if (data.type === "typing.stopped") {
            onTypingStop?.(data.user_id, data.username);
          } else if (data.type === "pong") {
            // Heartbeat response
          }
        } catch (error) {
          console.error("[WebSocket] Error parsing message:", error);
        }
      };

      ws.onerror = (error) => {
        // WebSocket error events don't provide detailed error info
        // The error object is typically empty, so we check readyState instead
        if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          // Only log if we're not already handling the close event
          console.warn("[WebSocket] Connection error occurred");
        }
        // Don't call onError here - let onclose handle it to avoid duplicate error handling
      };

      ws.onclose = (event) => {
        const wasConnected = isConnectedRef.current;
        setIsConnected(false);
        isConnectedRef.current = false;
        
        // Only log disconnections if we were actually connected
        if (wasConnected) {
          console.log("[WebSocket] Disconnected", event.code, event.reason || "No reason provided");
        }
        
        onDisconnect?.();

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Report error for abnormal closures (not normal closure, going away, or abnormal closure)
        // Code 1006 (abnormal closure) is common and usually just means connection was lost
        // Only report errors for protocol/extension errors (1002, 1003, 1007, etc.)
        if (event.code !== 1000 && event.code !== 1001 && event.code !== 1006) {
          // These are actual errors that should be reported
          onError?.(new Error(`WebSocket closed unexpectedly: ${event.code} ${event.reason || ""}`));
        } else if (event.code === 1006 && wasConnected) {
          // 1006 is common (network hiccup) - just log as warning if we were connected
          console.warn("[WebSocket] Connection lost (code 1006) - will attempt to reconnect");
        }

        // Attempt to reconnect if enabled and not a normal closure
        if (
          enabledRef.current &&
          event.code !== 1000 &&
          reconnectAttemptsRef.current < 5
        ) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(
            `[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            setReconnectAttempts(reconnectAttemptsRef.current);
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[WebSocket] Failed to connect:", error);
      onError?.(error as Error);
    }
  }, [conversationId, accessToken, onMessage, onError, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }
    setIsConnected(false);
    isConnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
  }, []);

  const startTyping = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing.start" }));
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to auto-stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 3000);
    }
  }, []);

  const stopTyping = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing.stop" }));
    }
    
    // Clear the timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
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
  }, [enabled, conversationId, accessToken]);

  return {
    isConnected,
    connect,
    disconnect,
    startTyping,
    stopTyping,
  };
}

