// hooks/useUser.ts
"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Profile = {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
};

export function useUser(id?: string | null) {
  const { accessToken, clearAuth } = useAuth();
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await apiGet<Profile>(`/auth/user/${id}/`, {
          token: accessToken,
          signal: ctrl.signal,
          cache: "no-store",
        });
        setData(res);
      } catch (e: any) {
        if (e?.status === 401) {
          // API handler will clear auth and redirect, just clear local state
          clearAuth();
        } else {
          setError(e?.message || "Failed to load user.");
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [id, accessToken, clearAuth]);

  return { data, loading, error };
}
