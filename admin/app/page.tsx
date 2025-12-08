"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { MetricCard } from "@/components/MetricCard";
import { SignupTrend } from "@/components/SignupTrend";
import { ApiError, fetchMetrics, login } from "@/lib/api";
import type { AdminMetrics, SignupDailyEntry, SignupMonthlyEntry } from "@/lib/types";

const TOKEN_STORAGE_KEY = "liberty-social-admin-access-token";

type AuthStep = "idle" | "working";

export default function AdminDashboardPage() {
  const [token, setToken] = useState(null as string | null);
  const [metrics, setMetrics] = useState(null as AdminMetrics | null);
  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState("idle" as AuthStep);
  const [error, setError] = useState(null as string | null);
  const [form, setForm] = useState({ username: "", password: "" });
  const [lastFetched, setLastFetched] = useState(null as string | null);

  // Load persisted token on first render
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      setToken(stored);
    }
  }, []);

  const flushAuthState = useCallback(() => {
    setToken(null);
    setMetrics(null);
    setLastFetched(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, []);

  const loadMetrics = useCallback(
    async (activeToken: string) => {
      setLoading(true);
      try {
        const data = await fetchMetrics(activeToken);
        setMetrics(data);
        setError(null);
        setLastFetched(new Date().toISOString());
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          flushAuthState();
          setError(
            "You are not authorised to view the admin dashboard. Please sign in with an admin account."
          );
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unable to load metrics. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    },
    [flushAuthState]
  );

  useEffect(() => {
    if (!token) return;
    void loadMetrics(token);
  }, [token, loadMetrics]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthStep("working");
    try {
      const result = await login(form.username.trim(), form.password);
      setToken(result.access_token);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, result.access_token);
      }
      setForm({ username: "", password: "" });
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid credentials. Please check your details and try again.");
      } else if (err instanceof Error) {
        setError(
          err.message.includes("NEXT_PUBLIC_API_BASE_URL")
            ? "NEXT_PUBLIC_API_BASE_URL is missing or invalid. Update the admin environment variables and restart the app."
            : err.message || "Unable to sign in. Please try again."
        );
      } else {
        setError("Unable to sign in. Please try again.");
      }
    } finally {
      setAuthStep("idle");
    }
  };

  const handleLogout = () => {
    flushAuthState();
  };

  const dailyEntries = useMemo(() => {
    if (!metrics) return [];
    return metrics.signups_per_day.map((entry: SignupDailyEntry) => ({
      id: entry.date,
      label: dayjs(entry.date).format("DD MMM"),
      value: entry.count,
    }));
  }, [metrics]);

  const monthlyEntries = useMemo(() => {
    if (!metrics) return [];
    return metrics.signups_per_month.map((entry: SignupMonthlyEntry) => ({
      id: entry.month,
      label: dayjs(entry.month).format("MMM YYYY"),
      value: entry.count,
    }));
  }, [metrics]);

  const lastUpdatedLabel = useMemo(() => {
    if (!metrics) return null;
    return dayjs(metrics.generated_at).format("DD MMM YYYY • HH:mm");
  }, [metrics]);

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="auth-eyebrow">Liberty Social</p>
          <h1 className="auth-title">Admin Console</h1>
          <p className="auth-subtitle">
            Sign in with an admin account to view internal metrics.
          </p>

          <form className="form" onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="username" className="label">
                Email or username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                value={form.username}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((prev: { username: string; password: string }) => ({
                    ...prev,
                    username: event.target.value,
                  }))
                }
                className="input"
                placeholder="admin@example.com"
              />
            </div>
            <div className="field">
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((prev: { username: string; password: string }) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                className="input"
                placeholder="••••••••"
              />
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            <button
              type="submit"
              disabled={authStep === "working"}
              className="btn btn--primary"
            >
              {authStep === "working" ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="auth-footnote">
            Need an account? Ask a system administrator to grant staff access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="dashboard-header__meta">
            <p className="dashboard-eyebrow">Internal Dashboard</p>
            <h1 className="dashboard-title">Liberty Social Overview</h1>
            {lastUpdatedLabel ? (
              <p className="dashboard-timestamp">
                Last generated: {lastUpdatedLabel}
              </p>
            ) : null}
          </div>
          <div className="dashboard-actions">
            <button
              type="button"
              onClick={() => token && loadMetrics(token)}
              className="btn btn--outline"
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn--danger"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="dashboard-content">
          {error ? <div className="alert">{error}</div> : null}

          <section className="metric-grid">
            <MetricCard
              title="Total users"
              value={
                metrics?.totals?.users !== undefined
                  ? metrics.totals.users.toLocaleString()
                  : "—"
              }
            />
            <MetricCard
              title="New (24h)"
              value={metrics?.new_users?.last_24_hours ?? "—"}
              subtitle="Users registered in the past 24 hours."
              tone="success"
            />
            <MetricCard
              title="New (7 days)"
              value={metrics?.new_users?.last_7_days ?? "—"}
              subtitle="Sign-ups in the last 7 days."
            />
            <MetricCard
              title="Users with posts"
              value={metrics?.users_with_posts ?? "—"}
              subtitle="Users who have created at least one post."
              tone="info"
            />
          </section>

          <section className="trend-grid">
            <SignupTrend
              title="Daily sign-ups (last 14 days)"
              entries={dailyEntries}
              emptyMessage="No recent sign-ups recorded."
            />
            <SignupTrend
              title="Monthly sign-ups (last 12 months)"
              entries={monthlyEntries}
              emptyMessage="No sign-up activity logged in this period."
            />
          </section>
        </main>

        <footer className="dashboard-footer">
          Data powered by Liberty Social API. Generated at{" "}
          {lastFetched ? dayjs(lastFetched).format("HH:mm:ss") : "—"}.
        </footer>
      </div>
    </div>
  );
}