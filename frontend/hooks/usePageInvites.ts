"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePaginatedResource } from "./usePaginatedResource";
import type { Notification } from "@/lib/types";

interface PageInvite {
  id: number;
  page: {
    id: number;
    name: string;
  };
  status: string;
}

const POLL_INTERVAL = 60000; // polling every minute

export function usePageInvites() {
  const { accessToken } = useAuth();
  const {
    items,
    count,
    loading,
    refresh,
  } = usePaginatedResource<PageInvite>("/page-invites/", {
    enabled: !!accessToken,
    query: { page_size: 1, status: "pending" }, // Only fetch pending invites for badge count
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearHeartbeat = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Periodic polling to keep invites fresh
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
    };
  }, [accessToken, refresh]);

  return {
    items,
    pendingCount: count,
    loading,
    refresh,
  };
}
