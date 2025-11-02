"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { apiPost, isApiError } from "@/lib/api";
import { AuthTokens, User, LoginRequest, RegisterRequest } from "@/lib/types";

/* -----------------------------
   🔐 Types
----------------------------- */

type AuthContextValue = {
  user: User | null;
  rawUser: User | User[] | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  hydrated: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearAuth: () => void;
  refreshUser: () => Promise<void>;
};

/* -----------------------------
   ⚙️ Config
----------------------------- */

const STORAGE_KEY = "liberty_auth_v1";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const HIDDEN_VALUE = "******";

const logAuthPayload = (action: "login" | "register", payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    console.info(`[auth] ${action} request`, "[unavailable payload]");
    return;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (typeof value === "string" && key.toLowerCase().includes("password")) {
      redacted[key] = HIDDEN_VALUE;
    } else {
      redacted[key] = value;
    }
  }
  console.info(`[auth] ${action} request`, redacted);
};

/* -----------------------------
   📦 Context
----------------------------- */

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* -----------------------------
   🧠 Provider
----------------------------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [rawUser, setRawUser] = useState<User | User[] | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  /* -----------------------------
     🔁 Load persisted session
  ----------------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setAccessToken(data.accessToken || null);
        setRefreshToken(data.refreshToken || null);
        setUser(normaliseUser(data.user));
        setRawUser(data.user || null);
      }
    } catch (err) {
      console.error("Error loading auth state:", err);
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, []);

  /* -----------------------------
     💾 Persist to localStorage
  ----------------------------- */
  const persist = (tokens: AuthTokens, userData?: User | User[]) => {
    const payload = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: userData || rawUser,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setAccessToken(payload.accessToken);
    setRefreshToken(payload.refreshToken);
    setRawUser(payload.user || null);
    setUser(normaliseUser(payload.user));
  };

  /* -----------------------------
     🧍 Fetch Current User
  ----------------------------- */
  const refreshUser = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/auth/user/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      setUser(normaliseUser(data));
      setRawUser(data);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accessToken,
          refreshToken,
          user: data[0] || data,
        })
      );
    } catch (err) {
      console.error("Error fetching user:", err);
      logout(); // fallback if token invalid
    }
  };

  /* -----------------------------
     🔐 Login
  ----------------------------- */
  const login = async (data: LoginRequest) => {
    setLoading(true);
    try {
      logAuthPayload("login", data);
      const tokens: AuthTokens = await apiPost("/auth/login/", data);
      const res = await fetch(`${API_BASE}/auth/user/`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const me = await res.json();
      persist(tokens, me);
    } catch (err) {
      if (isApiError(err)) {
        console.error("Login failed:", {
          status: err.status,
          message: err.message,
          fieldErrors: err.fieldErrors,
          nonFieldErrors: err.nonFieldErrors,
          data: err.data,
        });
      } else {
        console.error("Login failed:", err);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------
     🧾 Register
  ----------------------------- */
  const register = async (data: RegisterRequest) => {
    setLoading(true);
    try {
      logAuthPayload("register", data);
      const tokens: AuthTokens = await apiPost("/auth/register/", data);
      const res = await fetch(`${API_BASE}/auth/user/`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const me = await res.json();
      persist(tokens, me);
    } catch (err) {
      if (isApiError(err)) {
        console.error("Registration failed:", {
          status: err.status,
          message: err.message,
          fieldErrors: err.fieldErrors,
          nonFieldErrors: err.nonFieldErrors,
          data: err.data,
        });
      } else {
        console.error("Registration failed:", err);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------
     🚪 Logout
  ----------------------------- */
  const logout = async () => {
    try {
      if (refreshToken) {
        await apiPost("/auth/logout/", { refresh_token: refreshToken });
      }
    } catch (err) {
      console.warn("Logout API failed:", err);
    } finally {
      clearAuth();
    }
  };

  /* -----------------------------
     🧹 Clear All
  ----------------------------- */
  const clearAuth = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setRawUser(null);
  };

  /* -----------------------------
     🧩 Context Value
  ----------------------------- */
  const value = useMemo(
    () => ({
      user,
      rawUser,
      accessToken,
      refreshToken,
      loading,
      hydrated,
      isAuthenticated: !!accessToken && !!user,
      login,
      register,
      logout,
      clearAuth,
      refreshUser,
    }),
    [user, rawUser, accessToken, refreshToken, loading, hydrated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* -----------------------------
   🎯 Hook
----------------------------- */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function normaliseUser(payload: unknown): User | null {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object" ? (first as User) : null;
  }

  if (typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.results)) {
      const first = obj.results[0];
      return first && typeof first === "object" ? (first as User) : null;
    }
    return payload as User;
  }

  if (typeof payload === "string") {
    try {
      return normaliseUser(JSON.parse(payload));
    } catch {
      return null;
    }
  }

  return null;
}
