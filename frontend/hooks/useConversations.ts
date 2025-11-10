"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePaginatedResource } from "./usePaginatedResource";
import type { Conversation } from "@/lib/types";

const POLL_INTERVAL = 30000; // fallback polling every 30 seconds

export function useConversations() {
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
  } = usePaginatedResource<Conversation>("/conversations/", {
    enabled: !!accessToken,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRefreshRef = useRef(false);

  const scheduleRefresh = useCallback(() => {
    if (pendingRefreshRef.current) return;
    pendingRefreshRef.current = true;
    setTimeout(() => {
      pendingRefreshRef.current = false;
      refresh();
    }, 1000);
  }, [refresh]);

  // Polling fallback
  useEffect(() => {
    if (!accessToken) return;

    intervalRef.current = setInterval(() => {
      scheduleRefresh();
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [accessToken, scheduleRefresh]);

  return {
    conversations: items,
    count,
    loading,
    error,
    next,
    loadMore,
    loadingMore,
    refresh,
  };
}

