"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  fetchUserSecurity,
  fetchUserDevices,
  fetchUserActivity,
  lockUserAccount,
  unlockUserAccount,
  searchUsers,
  ApiError,
} from "@/lib/api";
import type {
  UserSecurityStatus,
  UserDevice,
  UserActivityEntry,
  UserSearchResult,
} from "@/lib/types";

const TOKEN_STORAGE_KEY = "liberty-social-admin-access-token";

export default function SecurityAdminPage() {
  const [token, setToken] = useState(null as string | null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([] as UserSearchResult[]);
  const [selectedUserId, setSelectedUserId] = useState(null as string | null);
  const [securityStatus, setSecurityStatus] = useState(null as UserSecurityStatus | null);
  const [devices, setDevices] = useState([] as UserDevice[]);
  const [activity, setActivity] = useState([] as UserActivityEntry[]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [actioning, setActioning] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "devices" | "activity">("overview");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) setToken(stored);
  }, []);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!token || !query.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const data = await searchUsers(token, query);
        const users = Array.isArray(data?.users) ? data.users : [];
        setSearchResults(users);
        setError(null);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to search users");
        }
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        void handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  const loadUserData = useCallback(
    async (userId: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const [security, devicesData, activityData] = await Promise.all([
          fetchUserSecurity(token, userId),
          fetchUserDevices(token, userId),
          fetchUserActivity(token, userId),
        ]);
        setSecurityStatus(security);
        setDevices(devicesData.devices || []);
        setActivity(activityData.activity || []);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load user data");
        }
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setSearchQuery("");
    setSearchResults([]);
    void loadUserData(userId);
  };

  const handleLock = async () => {
    if (!token || !selectedUserId) return;
    const reason = window.prompt("Enter reason for locking account (optional):", "");
    if (reason === null) return; // User cancelled
    setActioning(true);
    try {
      await lockUserAccount(token, selectedUserId, reason || "Locked by administrator");
      await loadUserData(selectedUserId);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to lock account");
      }
    } finally {
      setActioning(false);
    }
  };

  const handleUnlock = async () => {
    if (!token || !selectedUserId) return;
    if (!window.confirm("Are you sure you want to unlock this account?")) return;
    setActioning(true);
    try {
      await unlockUserAccount(token, selectedUserId);
      await loadUserData(selectedUserId);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to unlock account");
      }
    } finally {
      setActioning(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="auth-eyebrow">Liberty Social</p>
          <h1 className="auth-title">Security Admin</h1>
          <p className="auth-subtitle">Sign in to manage user security settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="dashboard-header__meta">
            <p className="dashboard-eyebrow">Security Management</p>
            <h1 className="dashboard-title">User Security Dashboard</h1>
            <p className="dashboard-timestamp">View and manage user security settings, devices, and activity</p>
          </div>
          <div className="dashboard-actions">
            {selectedUserId && securityStatus && (
              <>
                {securityStatus.account_locked ? (
                  <button
                    className="btn btn--success"
                    onClick={handleUnlock}
                    disabled={actioning}
                  >
                    {actioning ? "Unlocking…" : "Unlock Account"}
                  </button>
                ) : (
                  <button
                    className="btn btn--danger"
                    onClick={handleLock}
                    disabled={actioning}
                  >
                    {actioning ? "Locking…" : "Lock Account"}
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        <main className="dashboard-content">
          {error ? <div className="alert">{error}</div> : null}

          {/* User Search */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold mb-4">Search User</h2>
            <div className="field">
              <input
                type="text"
                className="input"
                placeholder="Search by username, email, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searching && (
                <div className="text-xs text-gray-600 mt-2">Searching…</div>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    className="w-full p-4 border rounded-lg text-left hover:bg-gray-50 flex items-center gap-3"
                    onClick={() => handleSelectUser(user.id)}
                  >
                    {user.image && (
                      <img
                        src={user.image}
                        alt={user.title}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{user.title}</div>
                      {user.description && (
                        <div className="text-xs text-gray-600 truncate">{user.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* User Security Details */}
          {selectedUserId && (
            <>
              {loading ? (
                <div className="text-center py-8">Loading user data…</div>
              ) : securityStatus ? (
                <>
                  {/* Tabs */}
                  <div className="security-tabs">
                    <button
                      className={`security-tab ${activeTab === "overview" ? "security-tab--active" : ""}`}
                      onClick={() => setActiveTab("overview")}
                    >
                      Overview
                    </button>
                    <button
                      className={`security-tab ${activeTab === "devices" ? "security-tab--active" : ""}`}
                      onClick={() => setActiveTab("devices")}
                    >
                      Devices ({devices.length})
                    </button>
                    <button
                      className={`security-tab ${activeTab === "activity" ? "security-tab--active" : ""}`}
                      onClick={() => setActiveTab("activity")}
                    >
                      Activity
                    </button>
                  </div>

                  {/* Overview Tab */}
                  {activeTab === "overview" && (
                    <section className="rounded-2xl border border-gray-200 bg-white p-6">
                      <h2 className="text-lg font-semibold mb-4">Security Status</h2>
                      <div className="space-y-3">
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm font-semibold">Email</div>
                          <div className="text-xs text-gray-600 mt-1">{securityStatus.email}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm font-semibold">Has Passkey</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {securityStatus.has_passkey ? "Yes" : "No"}
                          </div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm font-semibold">Active Devices</div>
                          <div className="text-xs text-gray-600 mt-1">{securityStatus.active_devices}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm font-semibold">Active Sessions</div>
                          <div className="text-xs text-gray-600 mt-1">{securityStatus.active_sessions}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm font-semibold">Account Status</div>
                          <div className="text-xs mt-1">
                            {securityStatus.account_locked ? (
                              <span style={{ color: "var(--error)" }}>Locked</span>
                            ) : (
                              <span style={{ color: "var(--emerald-500)" }}>Active</span>
                            )}
                          </div>
                          {securityStatus.account_locked && securityStatus.locked_reason && (
                            <div className="text-xs text-gray-600 mt-2">
                              Reason: {securityStatus.locked_reason}
                            </div>
                          )}
                          {securityStatus.account_locked_at && (
                            <div className="text-xs text-gray-600 mt-1">
                              Locked at: {new Date(securityStatus.account_locked_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Recent Events */}
                      {securityStatus.recent_events.length > 0 && (
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold mb-4">Recent Security Events</h3>
                          <div className="space-y-2">
                            {securityStatus.recent_events.map((event, idx) => (
                              <div key={idx} className="p-3 border rounded-lg">
                                <div className="text-sm font-semibold">{event.event_type}</div>
                                <div className="text-xs text-gray-600 mt-1">{event.description}</div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {event.ip_address && `IP: ${event.ip_address} • `}
                                  {new Date(event.created_at).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {/* Devices Tab */}
                  {activeTab === "devices" && (
                    <section className="rounded-2xl border border-gray-200 bg-white p-6">
                      <h2 className="text-lg font-semibold mb-4">Registered Devices</h2>
                      {devices.length === 0 ? (
                        <div className="text-gray-600">No devices registered.</div>
                      ) : (
                        <div className="space-y-3">
                          {devices.map((device) => (
                            <div key={device.id} className="p-4 border rounded-lg">
                              <div className="text-sm font-semibold mb-2">{device.device_name}</div>
                              <div className="text-xs text-gray-600 space-y-1">
                                <div>
                                  Created: {new Date(device.created_at).toLocaleString()}
                                </div>
                                {device.last_used_at && (
                                  <div>
                                    Last used: {new Date(device.last_used_at).toLocaleString()}
                                  </div>
                                )}
                                {device.location && <div>Location: {device.location}</div>}
                                {device.last_seen_location && (
                                  <div>Last seen: {device.last_seen_location}</div>
                                )}
                                {device.ip_address && <div>IP: {device.ip_address}</div>}
                                {device.last_seen_ip && <div>Last IP: {device.last_seen_ip}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Activity Tab */}
                  {activeTab === "activity" && (
                    <section className="rounded-2xl border border-gray-200 bg-white p-6">
                      <h2 className="text-lg font-semibold mb-4">Login Activity</h2>
                      {activity.length === 0 ? (
                        <div className="text-gray-600">No activity recorded.</div>
                      ) : (
                        <div className="space-y-3">
                          {activity.map((entry) => (
                            <div key={entry.id} className="p-4 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold">
                                  {entry.authentication_method === "passkey" ? "Passkey" : "Password"} Login
                                </div>
                                <div className="text-xs text-gray-600">
                                  {new Date(entry.created_at).toLocaleString()}
                                </div>
                              </div>
                              <div className="text-xs text-gray-600 space-y-1">
                                {entry.device_name && <div>Device: {entry.device_name}</div>}
                                {entry.location && <div>Location: {entry.location}</div>}
                                {entry.ip_address && <div>IP: {entry.ip_address}</div>}
                                {entry.user_agent && (
                                  <div className="truncate" title={entry.user_agent}>
                                    User Agent: {entry.user_agent}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-600">Select a user to view security details</div>
              )}
            </>
          )}
        </main>

        <footer className="dashboard-footer">
          Admin security actions are audited. Use responsibly.
        </footer>
      </div>
    </div>
  );
}

