"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePaginatedResource } from "./usePaginatedResource";
import type { Notification } from "@/lib/types";
import {
  ensureFirebaseMessaging,
  resolveFirebaseClientConfig,
} from "@/lib/firebase-web";

const POLL_INTERVAL = 60000; // fallback polling every minute

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

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRefreshRef = useRef<NodeJS.Timeout | null>(null);

  const clearHeartbeat = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const scheduleRefresh = useCallback(() => {
    if (pendingRefreshRef.current) return;
    pendingRefreshRef.current = setTimeout(async () => {
      pendingRefreshRef.current = null;
      await refresh();
    }, 250);
  }, [refresh]);

  // Periodic polling to keep inbox fresh
  useEffect(() => {
    if (!accessToken) {
      if (intervalRef.current) {
        clearHeartbeat();
      }
      return;
    }

    refresh();
    intervalRef.current = setInterval(() => {
      refresh();
    }, POLL_INTERVAL);

    return () => {
      clearHeartbeat();
      if (pendingRefreshRef.current) {
        clearTimeout(pendingRefreshRef.current);
        pendingRefreshRef.current = null;
      }
    };
  }, [accessToken, refresh]);

  // Foreground push notifications -> refresh
  useEffect(() => {
    if (!accessToken) return;

    let unsubscribeMessaging: (() => void) | null = null;
    let cancelled = false;

    async function attachForegroundListener() {
      try {
        const resolved = await resolveFirebaseClientConfig();
        if (!resolved || cancelled) return;
        const messaging = await ensureFirebaseMessaging(resolved.config);
        if (!messaging || cancelled) return;
        if (typeof messaging.onMessage === "function") {
          unsubscribeMessaging = messaging.onMessage(() => {
            scheduleRefresh();
          });
        }
      } catch (error) {
        console.warn("[notifications] Failed to attach FCM onMessage listener", error);
      }
    }

    attachForegroundListener();

    const swHandler = (event: MessageEvent) => {
      if (event.data?.type === "notification.push") {
        scheduleRefresh();
      }
    };
    if (typeof window !== "undefined" && navigator?.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", swHandler);
    }

    return () => {
      cancelled = true;
      if (unsubscribeMessaging) {
        try {
          unsubscribeMessaging();
        } catch {
          // ignore
        }
      }
      if (navigator?.serviceWorker) {
        navigator.serviceWorker.removeEventListener("message", swHandler);
      }
    };
  }, [accessToken, scheduleRefresh]);

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
