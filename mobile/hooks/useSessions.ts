import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/api';

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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<{ sessions: Session[] }>('/auth/sessions/');
      setSessions(data.sessions || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const revokeAll = useCallback(async () => {
    try {
      await apiClient.post('/auth/sessions/revoke-all/', {});
      await fetchSessions();
    } catch (err: any) {
      throw new Error(err?.response?.data?.detail || err?.message || 'Failed to revoke sessions');
    }
  }, [fetchSessions]);

  return {
    sessions,
    loading,
    error,
    refetch: fetchSessions,
    revokeAll,
  };
}

