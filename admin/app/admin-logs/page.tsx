"use client";

import React, { useEffect, useState } from "react";
import { fetchAdminLogs } from "@/lib/api";
import type { AdminActionLogEntry } from "@/lib/types";

const TOKEN_STORAGE_KEY = "liberty-social-admin-access-token";

export default function AdminLogsPage() {
  const [token, setToken] = React.useState(null as string | null);
  const [logs, setLogs] = React.useState([] as AdminActionLogEntry[]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null as string | null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadLogs();
  }, [token]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminLogs(token!);
      // Expect paginated DRF response with results
      const results = Array.isArray(data) ? data : (data && (data.results || data.items)) || [];
      setLogs(results as AdminActionLogEntry[]);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load admin logs");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="auth-eyebrow">Liberty Social</p>
          <h1 className="auth-title">Admin Logs</h1>
          <p className="auth-subtitle">Sign in to view recent admin actions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="dashboard-header__meta">
            <p className="dashboard-eyebrow">Audit</p>
            <h1 className="dashboard-title">Admin Action Logs</h1>
            <p className="dashboard-timestamp">Recent admin actions (read-only)</p>
          </div>
          <div className="dashboard-actions">
            <button className="btn btn--outline" onClick={() => loadLogs()} disabled={loading}>
              Refresh
            </button>
          </div>
        </header>

        <main className="dashboard-content">
          {error ? <div className="alert">{error}</div> : null}

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            {loading ? (
              <div>Loading…</div>
            ) : logs.length === 0 ? (
              <div className="text-gray-600">No logs found.</div>
            ) : (
              <div className="space-y-2">
                {logs.map((l: AdminActionLogEntry) => (
                  <div key={l.id} className="p-3 border rounded-lg">
                    <div className="text-sm font-semibold">{l.action_type} on {l.target_type}#{l.target_id}</div>
                    <div className="text-xs text-gray-600">By: {l.performed_by?.username || 'system'} • {new Date(l.created_at || '').toLocaleString()}</div>
                    {l.notes ? <div className="mt-2 text-xs">{l.notes}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        <footer className="dashboard-footer">Read-only audit logs for administrative actions.</footer>
      </div>
    </div>
  );
}
