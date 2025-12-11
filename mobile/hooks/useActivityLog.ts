import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/api';

export type ActivityEntry = {
  id: string;
  device_id: string | null;
  device_name: string | null;
  ip_address: string | null;
  location: string | null;
  user_agent: string | null;
  authentication_method: 'password' | 'passkey';
  created_at: string;
  ended_at: string | null;
};

export function useActivityLog() {
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const fetchActivity = useCallback(
    async (limit = 50, offset = 0) => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get<{ activity: ActivityEntry[]; count: number }>(
          `/auth/activity/?limit=${limit}&offset=${offset}`
        );
        setActivity(data.activity || []);
        setCount(data.count || 0);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load activity log');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    activity,
    count,
    loading,
    error,
    refetch: () => fetchActivity(),
  };
}

