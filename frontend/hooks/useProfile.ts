// hooks/useProfile.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { User } from "@/lib/types";

type Profile = User;

export function useProfile() {
  const { accessToken, clearAuth } = useAuth();
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken) {
        setData(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await apiGet<Profile | Profile[] | { results?: Profile[] }>("/auth/user/", {
          token: accessToken,
          signal,
          cache: "no-store",
        });
        let profile: Profile | null = null;
        if (Array.isArray(res)) {
          profile = res[0] ?? null;
        } else if (hasResults(res)) {
          profile = res.results?.[0] ?? null;
        } else if (res && typeof res === "object") {
          profile = res as Profile;
        }
        setData(profile);
      } catch (e: unknown) {
        if (typeof e === "object" && e && "name" in e && (e as { name: string }).name === "AbortError") {
          return;
        }
        const err = e as { status?: number; message?: string };
        if (err?.status === 401) {
          clearAuth();
        } else {
          setError(err?.message || "Failed to load profile.");
        }
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, clearAuth]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchProfile(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchProfile]);

  const refetch = useCallback(() => {
    void fetchProfile();
  }, [fetchProfile]);

  return { data, loading, error, refetch };
}

function hasResults(
  payload: Profile | Profile[] | { results?: Profile[] }
): payload is { results?: Profile[] } {
  return typeof payload === "object" && payload !== null && "results" in payload;
}
