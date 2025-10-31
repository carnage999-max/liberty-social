"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export type UserSettings = {
  id: number;
  profile_privacy: "public" | "private" | "only_me";
  friends_publicity: "public" | "private" | "only_me";
};

type SettingsState = {
  data: UserSettings | null;
  loading: boolean;
  error: string | null;
};

export function useUserSettings() {
  const { accessToken, clearAuth } = useAuth();
  const [state, setState] = useState<SettingsState>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchSettings = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken) {
        setState({ data: null, loading: false, error: null });
        return;
      }
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await apiGet<UserSettings>("/auth/settings/", {
          token: accessToken,
          cache: "no-store",
          signal,
        });
        setState({ data: res, loading: false, error: null });
      } catch (e: any) {
        if (e?.status === 401) clearAuth();
        setState({
          data: null,
          loading: false,
          error: e?.message || "Failed to load settings.",
        });
      }
    },
    [accessToken, clearAuth]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchSettings(controller.signal);
    return () => controller.abort();
  }, [fetchSettings]);

  const refetch = useCallback(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (updates: Partial<UserSettings>) => {
      if (!accessToken) return null;
      try {
        const res = await apiPatch<UserSettings>("/auth/settings/", updates, {
          token: accessToken,
          cache: "no-store",
        });
        setState({ data: res, loading: false, error: null });
        return res;
      } catch (e: any) {
        if (e?.status === 401) clearAuth();
        setState((prev) => ({
          ...prev,
          error: e?.message || "Unable to update settings.",
        }));
        throw e;
      }
    },
    [accessToken, clearAuth]
  );

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch,
    updateSettings,
  };
}

