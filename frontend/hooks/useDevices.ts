"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

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
  const { accessToken } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<{ devices: Device[] }>("/auth/devices/", {
        token: accessToken,
      });
      setDevices(data.devices || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const renameDevice = useCallback(
    async (deviceId: string, newName: string) => {
      if (!accessToken) throw new Error("Not authenticated");

      try {
        await apiPatch(
          `/auth/devices/${deviceId}/`,
          { device_name: newName },
          { token: accessToken }
        );
        await fetchDevices();
      } catch (err: any) {
        throw new Error(err?.message || "Failed to rename device");
      }
    },
    [accessToken, fetchDevices]
  );

  const removeDevice = useCallback(
    async (deviceId: string) => {
      if (!accessToken) throw new Error("Not authenticated");

      try {
        await apiDelete(`/auth/devices/${deviceId}/`, {
          token: accessToken,
        });
        await fetchDevices();
      } catch (err: any) {
        throw new Error(err?.message || "Failed to remove device");
      }
    },
    [accessToken, fetchDevices]
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

