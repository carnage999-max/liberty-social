// hooks/useProfile.ts
"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Profile = {
  id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  // add more as backend grows
};

export function useProfile() {
  const { accessToken, clearAuth } = useAuth();
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await apiGet<Profile>("/auth/user/", {
          token: accessToken,
          signal: ctrl.signal,
          cache: "no-store",
        });
        setData(res);
      } catch (e: any) {
        if (e?.status === 401) clearAuth();
        else setError(e?.message || "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [accessToken, clearAuth]);

  return { data, loading, error, refetch: () => {} };
}
