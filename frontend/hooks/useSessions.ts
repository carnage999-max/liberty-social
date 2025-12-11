"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export type Session = {
  id: string;
  device_id: string | null;
  device_name: string | null;
  ip_address: string | null;
  location: string | null;
  user_agent: string | null;
  created_at: string;
  last_activity: string;
  is_current?: boolean;
};

export function useSessions() {
  const { accessToken } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<{ sessions: Session[] }>("/auth/sessions/", {
        token: accessToken,
      });
      setSessions(data.sessions || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const revokeAll = useCallback(async () => {
    if (!accessToken) throw new Error("Not authenticated");

    try {
      await apiPost(
        "/auth/sessions/revoke-all/",
        {},
        { token: accessToken }
      );
      await fetchSessions();
    } catch (err: any) {
      throw new Error(err?.message || "Failed to revoke sessions");
    }
  }, [accessToken, fetchSessions]);

  return {
    sessions,
    loading,
    error,
    refetch: fetchSessions,
    revokeAll,
  };
}

