"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePaginatedResource } from "./usePaginatedResource";
import type { Notification } from "@/lib/types";
import { API_BASE } from "@/lib/api";

const POLL_INTERVAL = 60000; // fallback polling every minute
const HEARTBEAT_INTERVAL = 30000;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

function resolveWebSocketBase(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_BASE_URL;
  if (explicit && explicit.trim()) {
    return explicit.replace(/\/$/, "");
  }
  if (API_BASE) {
    return API_BASE.replace(/\/$/, "").replace(/^http/, "ws");
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}`;
  }
  return "";
}

export function useNotifications() {
  const { accessToken } = useAuth();
  const {
    items,
    count,
    loading,
    error,
    next,
    loadMore,
    loadingMore,
    refresh,
  } = usePaginatedResource<Notification>("/notifications/", {
    enabled: !!accessToken,
  });

  const [socketActive, setSocketActive] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef<number>(INITIAL_RECONNECT_DELAY);
  const pendingRefreshRef = useRef<NodeJS.Timeout | null>(null);

  const clearHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const scheduleRefresh = useCallback(() => {
    if (pendingRefreshRef.current) return;
    pendingRefreshRef.current = setTimeout(async () => {
      pendingRefreshRef.current = null;
      await refresh();
    }, 250);
  }, [refresh]);

  const connectSocket = useCallback(
    (token: string) => {
      const base = resolveWebSocketBase();
      const urlBase = base ? `${base}/ws/notifications/` : "/ws/notifications/";
      const socketUrl = `${urlBase}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(socketUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        setSocketActive(true);
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
        clearHeartbeat();
        heartbeatRef.current = setInterval(() => {
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({ type: "ping" }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "notification.created") {
            scheduleRefresh();
          }
        } catch (err) {
          console.error("Failed to parse notification payload", err);
        }
      };

      ws.onclose = () => {
        setSocketActive(false);
        clearHeartbeat();
        websocketRef.current = null;
        if (!token) return;
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(
          delay * 2,
          MAX_RECONNECT_DELAY
        );
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          connectSocket(token);
        }, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    },
    [scheduleRefresh]
  );

  // WebSocket lifecycle
  useEffect(() => {
    if (!accessToken) {
      setSocketActive(false);
      clearHeartbeat();
      clearReconnectTimer();
      websocketRef.current?.close();
      websocketRef.current = null;
      return;
    }

    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    connectSocket(accessToken);

    return () => {
      setSocketActive(false);
      clearHeartbeat();
      clearReconnectTimer();
      websocketRef.current?.close();
      websocketRef.current = null;
      if (pendingRefreshRef.current) {
        clearTimeout(pendingRefreshRef.current);
        pendingRefreshRef.current = null;
      }
    };
  }, [accessToken, connectSocket]);

  // Polling fallback when socket is not active
  useEffect(() => {
    if (!accessToken || socketActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      refresh();
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [accessToken, socketActive, refresh]);

  // Get unread count
  const unreadCount = items.filter((n) => n.unread).length;

  return {
    notifications: items,
    unreadCount,
    count,
    loading,
    error,
    next,
    loadMore,
    loadingMore,
    refresh,
  };
}
