"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  fetchModerationActions,
  fetchComplianceLogs,
  fetchClassifications,
  fetchAppealsAdmin,
  decideAppealAdmin,
  bulkDecideAppealsAdmin,
  exportModerationActions,
  exportComplianceLogs,
  exportClassifications,
} from "@/lib/api";
import type {
  ModerationActionEntry,
  ComplianceLogEntry,
  ContentClassificationEntry,
  AppealEntry,
} from "@/lib/types";

const TOKEN_STORAGE_KEY = "liberty-social-admin-access-token";

type TabKey = "actions" | "classifications" | "compliance" | "appeals";

export default function ModerationPage() {
  const [token, setToken] = useState(null as string | null);
  const [activeTab, setActiveTab] = useState("actions" as TabKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);

  const [actions, setActions] = useState([] as ModerationActionEntry[]);
  const [classifications, setClassifications] = useState([] as ContentClassificationEntry[]);
  const [complianceLogs, setComplianceLogs] = useState([] as ComplianceLogEntry[]);
  const [appeals, setAppeals] = useState([] as AppealEntry[]);
  const [selectedAppeals, setSelectedAppeals] = useState(new Set<number>());

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [contentType, setContentType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [label, setLabel] = useState("");
  const [layer, setLayer] = useState("");
  const [action, setAction] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [count, setCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState(
    null as
      | ModerationActionEntry
      | ContentClassificationEntry
      | ComplianceLogEntry
      | AppealEntry
      | null
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) setToken(stored);
  }, []);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (start) params.start = start;
    if (end) params.end = end;
    if (contentType) params.content_type = contentType;
    if (objectId) params.object_id = objectId;
    if (label) params.label = label;
    if (layer) params.layer = layer;
    if (action) params.action = action;
    if (category) params.category = category;
    if (status) params.status = status;
    params.page = String(page);
    params.page_size = String(pageSize);
    return params;
  }, [start, end, contentType, objectId, label, layer, action, category, status, page, pageSize]);

  useEffect(() => {
    if (!token) return;
    loadActiveTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab, page, pageSize, filters]);

  const loadActiveTab = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "actions") {
        const data = await fetchModerationActions(token, filters);
        const items = Array.isArray(data) ? data : data?.results || [];
        const total = Array.isArray(data) ? items.length : data?.count || items.length;
        setActions(items);
        setCount(total);
      } else if (activeTab === "classifications") {
        const data = await fetchClassifications(token, filters);
        const items = Array.isArray(data) ? data : data?.results || [];
        const total = Array.isArray(data) ? items.length : data?.count || items.length;
        setClassifications(items);
        setCount(total);
      } else if (activeTab === "compliance") {
        const data = await fetchComplianceLogs(token, filters);
        const items = Array.isArray(data) ? data : data?.results || [];
        const total = Array.isArray(data) ? items.length : data?.count || items.length;
        setComplianceLogs(items);
        setCount(total);
      } else if (activeTab === "appeals") {
        const data = await fetchAppealsAdmin(token, filters);
        const items = Array.isArray(data) ? data : data?.results || [];
        const total = Array.isArray(data) ? items.length : data?.count || items.length;
        setAppeals(items);
        setCount(total);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load moderation data.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      if (activeTab === "actions") {
        await exportModerationActions(token, filters, "moderation_actions.csv");
      } else if (activeTab === "classifications") {
        await exportClassifications(token, filters, "content_classifications.csv");
      } else if (activeTab === "compliance") {
        await exportComplianceLogs(token, filters, "compliance_logs.csv");
      }
    } catch (err) {
      console.error(err);
      setError("Export failed.");
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const toggleAppealSelection = (id: number) => {
    setSelectedAppeals((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDecision = async (decision: "approved" | "rejected") => {
    if (!token || selectedAppeals.size === 0) return;
    setLoading(true);
    try {
      await bulkDecideAppealsAdmin(token, Array.from(selectedAppeals), decision);
      setSelectedAppeals(new Set());
      await loadActiveTab();
    } catch (err) {
      console.error(err);
      setError("Bulk decision failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSingleDecision = async (id: number, decision: "approved" | "rejected") => {
    if (!token) return;
    setLoading(true);
    try {
      await decideAppealAdmin(token, id, decision);
      await loadActiveTab();
    } catch (err) {
      console.error(err);
      setError("Decision failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="auth-eyebrow">Liberty Social</p>
          <h1 className="auth-title">Moderation Console</h1>
          <p className="auth-subtitle">Sign in to review moderation activity.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="dashboard-header__meta">
            <p className="dashboard-eyebrow">Trust & Safety</p>
            <h1 className="dashboard-title">Moderation Review</h1>
            <p className="dashboard-timestamp">Actions, classifications, compliance logs, and appeals</p>
          </div>
          <div className="dashboard-actions">
            <button className="btn btn--outline" onClick={loadActiveTab} disabled={loading}>
              Refresh
            </button>
            {activeTab !== "appeals" ? (
              <button className="btn btn--primary" onClick={handleExport} disabled={loading}>
                Export CSV
              </button>
            ) : null}
          </div>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">Start (ISO)</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={start}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStart(e.target.value)}
                placeholder="2026-02-02T00:00:00Z"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">End (ISO)</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={end}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnd(e.target.value)}
                placeholder="2026-02-02T23:59:59Z"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Content Type</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={contentType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setContentType(e.target.value)}
              >
                <option value="">All</option>
                <option value="main.post">main.post</option>
                <option value="main.comment">main.comment</option>
                <option value="main.message">main.message</option>
                <option value="main.page">main.page</option>
                <option value="main.marketplacelisting">main.marketplacelisting</option>
                <option value="main.animallisting">main.animallisting</option>
                <option value="main.breederdirectory">main.breederdirectory</option>
                <option value="main.yardsalelisting">main.yardsalelisting</option>
                <option value="users.user">users.user</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Object ID</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={objectId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setObjectId(e.target.value)}
                placeholder="123"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Label</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={label}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
                placeholder="Explicit adult content"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Layer</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={layer}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLayer(e.target.value)}
              >
                <option value="">All</option>
                <option value="L1">L1</option>
                <option value="L2">L2</option>
                <option value="L3">L3</option>
                <option value="L4">L4</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Action</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={action}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAction(e.target.value)}
              >
                <option value="">All</option>
                <option value="block">block</option>
                <option value="label">label</option>
                <option value="throttle">throttle</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Category</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={category}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
                placeholder="csam"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Appeal Status</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            <div className="ml-auto flex gap-2">
              {(["actions", "classifications", "compliance", "appeals"] as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  className={`btn ${activeTab === tab ? "btn--primary" : "btn--outline"}`}
                  onClick={() => {
                    setActiveTab(tab);
                    setPage(1);
                    setSelectedItem(null);
                  }}
                >
                  {tab === "actions"
                    ? "Actions"
                    : tab === "classifications"
                    ? "Classifications"
                    : tab === "compliance"
                    ? "Compliance"
                    : "Appeals"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="text-xs text-gray-500">
              Page {page} of {totalPages} · {count} total
            </div>
            <button className="btn btn--outline" onClick={() => setPage(1)} disabled={!canPrev}>
              First
            </button>
            <button className="btn btn--outline" onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={!canPrev}>
              Prev
            </button>
            <button className="btn btn--outline" onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))} disabled={!canNext}>
              Next
            </button>
            <button className="btn btn--outline" onClick={() => setPage(totalPages)} disabled={!canNext}>
              Last
            </button>
            <div className="ml-auto">
              <label className="text-xs font-semibold text-gray-600">Page Size</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={pageSize}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setPage(1);
                  setPageSize(Number(e.target.value));
                }}
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <main className="dashboard-content">
          {error ? <div className="alert">{error}</div> : null}

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            {loading ? (
              <div>Loading…</div>
            ) : activeTab === "actions" ? (
              <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                <div className="space-y-3">
                {actions.length === 0 ? (
                  <div className="text-gray-600">No moderation actions found.</div>
                ) : (
                  actions.map((item: ModerationActionEntry) => (
                    <button
                      key={item.id}
                      className="w-full text-left rounded-lg border border-gray-200 p-4 hover:border-gray-300"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="text-sm font-semibold">
                        {item.layer} · {item.action} · {item.reason_code}
                      </div>
                      <div className="text-xs text-gray-600">
                        {item.content_type?.model || "unknown"} #{item.object_id || "n/a"} · Actor {item.actor || "system"}
                      </div>
                      <div className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</div>
                    </button>
                  ))
                )}
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-600">Details</div>
                  {!selectedItem ? (
                    <div className="mt-2 text-xs text-gray-500">Select a row to see details.</div>
                  ) : (
                    <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedItem, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ) : activeTab === "classifications" ? (
              <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                <div className="space-y-3">
                {classifications.length === 0 ? (
                  <div className="text-gray-600">No classifications found.</div>
                ) : (
                  classifications.map((item: ContentClassificationEntry) => (
                    <button
                      key={item.id}
                      className="w-full text-left rounded-lg border border-gray-200 p-4 hover:border-gray-300"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="text-sm font-semibold">
                        {item.content_type?.model || "unknown"} #{item.object_id}
                      </div>
                      <div className="text-xs text-gray-600">Labels: {(item.labels || []).join(", ") || "None"}</div>
                      <div className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</div>
                    </button>
                  ))
                )}
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-600">Details</div>
                  {!selectedItem ? (
                    <div className="mt-2 text-xs text-gray-500">Select a row to see details.</div>
                  ) : (
                    <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedItem, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ) : activeTab === "compliance" ? (
              <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                <div className="space-y-3">
                {complianceLogs.length === 0 ? (
                  <div className="text-gray-600">No compliance logs found.</div>
                ) : (
                  complianceLogs.map((item: ComplianceLogEntry) => (
                    <button
                      key={item.id}
                      className="w-full text-left rounded-lg border border-gray-200 p-4 hover:border-gray-300"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="text-sm font-semibold">
                        {item.layer} · {item.category}
                      </div>
                      <div className="text-xs text-gray-600">
                        {item.content_type?.model || "unknown"} #{item.object_id || "n/a"} · Actor {item.actor || "system"}
                      </div>
                      <div className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</div>
                      {item.content_snippet ? (
                        <div className="mt-2 text-xs text-gray-700">{item.content_snippet}</div>
                      ) : null}
                    </button>
                  ))
                )}
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-600">Details</div>
                  {!selectedItem ? (
                    <div className="mt-2 text-xs text-gray-500">Select a row to see details.</div>
                  ) : (
                    <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedItem, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                <div className="space-y-3">
                {appeals.length === 0 ? (
                  <div className="text-gray-600">No appeals found.</div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn btn--outline"
                        onClick={() => handleBulkDecision("approved")}
                        disabled={selectedAppeals.size === 0 || loading}
                      >
                        Approve Selected
                      </button>
                      <button
                        className="btn btn--outline"
                        onClick={() => handleBulkDecision("rejected")}
                        disabled={selectedAppeals.size === 0 || loading}
                      >
                        Reject Selected
                      </button>
                      <span className="text-xs text-gray-500">
                        {selectedAppeals.size} selected
                      </span>
                    </div>
                    {appeals.map((item: AppealEntry) => (
                      <button
                        key={item.id}
                        className="w-full text-left rounded-lg border border-gray-200 p-4 hover:border-gray-300"
                        onClick={() => setSelectedItem(item)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold">
                              Appeal #{item.id} · {item.status}
                            </div>
                            <div className="text-xs text-gray-600">
                              Action #{item.moderation_action} · User {item.user}
                            </div>
                            <div className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600">
                              <input
                                type="checkbox"
                                className="mr-2"
                                checked={selectedAppeals.has(item.id)}
                                onChange={() => toggleAppealSelection(item.id)}
                              />
                              Select
                            </label>
                            <button
                              className="btn btn--outline"
                              onClick={() => handleSingleDecision(item.id, "approved")}
                              disabled={loading}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn--outline"
                              onClick={() => handleSingleDecision(item.id, "rejected")}
                              disabled={loading}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                        {item.reason ? <div className="mt-2 text-xs text-gray-700">{item.reason}</div> : null}
                      </button>
                    ))}
                  </>
                )}
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-600">Details</div>
                  {!selectedItem ? (
                    <div className="mt-2 text-xs text-gray-500">Select a row to see details.</div>
                  ) : (
                    <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedItem, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </section>
        </main>

        <footer className="dashboard-footer">Moderation review console for staff.</footer>
      </div>
    </div>
  );
}
