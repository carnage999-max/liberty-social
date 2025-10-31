// lib/auth-context.tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiPost } from "./api";

type Tokens = {
  access_token: string;
  refresh_token: string;
  user_id: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  username: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
};

type AuthContextValue = {
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
};


const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "liberty_auth_v1";
const MOCK = String(process.env.NEXT_PUBLIC_AUTH_MOCK) === "true";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    userId: string | null;
    accessToken: string | null;
    refreshToken: string | null;
  }>({ userId: null, accessToken: null, refreshToken: null });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (tokens: Tokens | null) => {
    if (!tokens) {
      localStorage.removeItem(STORAGE_KEY);
      setState({ userId: null, accessToken: null, refreshToken: null });
      return;
    }
    const next = {
      userId: tokens.user_id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setState(next);
  };

  const login = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        persist({
          access_token: "mock_access",
          refresh_token: "mock_refresh",
          user_id: "00000000-0000-4000-8000-000000000001",
        });
        return;
      }
      const data = await apiPost("/auth/login/", {
        username: identifier,
        password,
      });
      persist({
        access_token: data?.access_token,
        refresh_token: data?.refresh_token,
        user_id: data?.user_id,
      });
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setLoading(true);
    try {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 500));
        persist({
          access_token: "mock_access",
          refresh_token: "mock_refresh",
          user_id: "00000000-0000-4000-8000-000000000002",
        });
        return;
      }
      const data = await apiPost("/auth/register/", {
        email: payload.email,
        password: payload.password,
        username: payload.username,
        first_name: payload.first_name ?? "",
        last_name: payload.last_name ?? "",
      });
      persist({
        access_token: data?.access_token,
        refresh_token: data?.refresh_token,
        user_id: data?.user_id,
      });
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (!MOCK && state.refreshToken) {
        await apiPost("/auth/logout/", { refresh_token: state.refreshToken });
      }
      persist(null);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextValue = useMemo(
    () => ({
      userId: state.userId,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      loading,
      login,
      register,
      logout,
    }),
    [state, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
