"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { MetricCard } from "@/components/MetricCard";
import { SignupTrend } from "@/components/SignupTrend";
import { ApiError, fetchMetrics, login } from "@/lib/api";
import type { AdminMetrics } from "@/lib/types";

const TOKEN_STORAGE_KEY = "liberty-social-admin-access-token";

type AuthStep = "idle" | "working";

export default function AdminDashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ username: "", password: "" });
  const [lastFetched, setLastFetched] = useState<string | null>(null);

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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
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
    return metrics.signups_per_day.map((entry) => ({
      id: entry.date,
      label: dayjs(entry.date).format("DD MMM"),
      value: entry.count,
    }));
  }, [metrics]);

  const monthlyEntries = useMemo(() => {
    if (!metrics) return [];
    return metrics.signups_per_month.map((entry) => ({
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
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-lg">
          <h1 className="text-2xl font-semibold text-slate-900">
            Liberty Social Admin
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in with an admin account to view internal metrics.
          </p>
          <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-slate-700">
                Email or username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                value={form.username}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, username: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="••••••••"
              />
            </div>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <button
              type="submit"
              disabled={authStep === "working"}
              className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authStep === "working" ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 pb-10">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
            Internal Dashboard
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            Liberty Social Overview
          </h1>
          {lastUpdatedLabel ? (
            <p className="mt-1 text-sm text-slate-500">
              Last generated: {lastUpdatedLabel}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => token && loadMetrics(token)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-400 hover:text-indigo-700"
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-8">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            title="Active (30 days)"
            value={metrics?.active_users?.last_30_days ?? "—"}
            subtitle="Users who logged in at least once."
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
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

      <footer className="mx-auto mt-12 w-full max-w-6xl border-t border-slate-200 pt-6 text-xs text-slate-500">
        Data powered by Liberty Social API. Generated at{" "}
        {lastFetched ? dayjs(lastFetched).format("HH:mm:ss") : "—"}.
      </footer>
    </div>
  );
}
