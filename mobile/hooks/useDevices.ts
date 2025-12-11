import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/api';

export type Device = {
  id: string;
  device_name: string;
  device_info: Record<string, unknown>;
  ip_address: string | null;
  location: string | null;
  last_seen_ip: string | null;
  last_seen_location: string | null;
  created_at: string;
  last_used_at: string | null;
};

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<{ devices: Device[] }>('/auth/devices/');
      setDevices(data.devices || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const renameDevice = useCallback(
    async (deviceId: string, newName: string) => {
      try {
        await apiClient.patch(`/auth/devices/${deviceId}/`, { device_name: newName });
        await fetchDevices();
      } catch (err: any) {
        throw new Error(err?.response?.data?.detail || err?.message || 'Failed to rename device');
      }
    },
    [fetchDevices]
  );

  const removeDevice = useCallback(
    async (deviceId: string) => {
      try {
        await apiClient.delete(`/auth/devices/${deviceId}/`);
        await fetchDevices();
      } catch (err: any) {
        throw new Error(err?.response?.data?.detail || err?.message || 'Failed to remove device');
      }
    },
    [fetchDevices]
  );

  return {
    devices,
    loading,
    error,
    refetch: fetchDevices,
    renameDevice,
    removeDevice,
  };
}

