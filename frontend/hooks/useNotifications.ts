"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePaginatedResource } from "./usePaginatedResource";
import type { Notification } from "@/lib/types";

const POLL_INTERVAL = 10000; // 10 seconds

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

  // Set up polling
  useEffect(() => {
    if (!accessToken) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Poll for new notifications
    intervalRef.current = setInterval(() => {
      refresh();
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [accessToken, refresh]);

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

