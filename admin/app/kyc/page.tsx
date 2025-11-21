"use client";

import React, { useEffect, useState } from "react";
import { fetchKycSubmissions, approveKyc, rejectKyc, ApiError } from "@/lib/api";

type KycSubmission = {
    id: number;
    full_name: string;
    user?: { username?: string } | null;
    city?: string | null;
    state_code?: string | null;
    created_at?: string | null;
    status?: string | null;
    id_document_url?: string | null;
    breeder_license_url?: string | null;
};

const TOKEN_STORAGE_KEY = "liberty-social-admin-access-token";

export default function KycAdminPage() {
    const [token, setToken] = useState(null as string | null);
    const [submissions, setSubmissions] = useState([] as KycSubmission[]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null as string | null);
    const [actioning, setActioning] = useState(null as number | null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
        if (stored) setToken(stored);
    }, []);

    useEffect(() => {
        if (!token) return;
        loadSubmissions();
    }, [token]);

    const loadSubmissions = async (): Promise<void> => {
        setLoading(true);
        try {
            const data = await fetchKycSubmissions(token!);
            setSubmissions((data as KycSubmission[]) || []);
            setError(null);
        } catch (err) {
            if (err instanceof ApiError || (err && (err as any).message)) {
                setError((err as any).message || String(err));
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Failed to load submissions");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: number): Promise<void> => {
        if (!token) return;
        setActioning(id);
        try {
            await approveKyc(token, id);
            await loadSubmissions();
        } catch (err) {
            console.error(err);
            setError("Failed to approve submission");
        } finally {
            setActioning(null);
        }
    };

    const handleReject = async (id: number): Promise<void> => {
        if (!token) return;
        const reason = typeof window !== "undefined" ? window.prompt("Rejection reason (optional):", "") : "";
        setActioning(id);
        try {
            await rejectKyc(token, id, reason || undefined);
            await loadSubmissions();
        } catch (err) {
            console.error(err);
            setError("Failed to reject submission");
        } finally {
            setActioning(null);
        }
    };

    if (!token) {
        return (
            <div className="auth-shell">
                <div className="auth-card">
                    <p className="auth-eyebrow">Liberty Social</p>
                    <h1 className="auth-title">KYC Admin</h1>
                    <p className="auth-subtitle">Sign in to view seller verification submissions.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <div className="dashboard-header__meta">
                        <p className="dashboard-eyebrow">KYC</p>
                        <h1 className="dashboard-title">Seller Verification Submissions</h1>
                        <p className="dashboard-timestamp">Manage pending KYC applications</p>
                    </div>
                    <div className="dashboard-actions">
                        <button className="btn btn--outline" onClick={() => loadSubmissions()} disabled={loading}>
                            Refresh
                        </button>
                    </div>
                </header>

                <main className="dashboard-content">
                    {error ? <div className="alert">{error}</div> : null}

                    <section className="rounded-2xl border border-gray-200 bg-white p-6">
                        <h2 className="text-lg font-semibold mb-4">Submissions</h2>

                        {loading ? (
                            <div>Loading…</div>
                        ) : submissions.length === 0 ? (
                            <div className="text-gray-600">No submissions found.</div>
                        ) : (
                            <div className="space-y-3">
                                {submissions.map((s: { id: number; full_name: any; user: { username: any; }; city: any; state_code: any; created_at: string | number | Date; status: any; id_document_url: any; breeder_license_url: any; }) => (
                                    <div key={s.id} className="p-4 border rounded-lg flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-semibold">{s.full_name} — @{s.user?.username || 'user'}</div>
                                            <div className="text-xs text-gray-600">{s.city}, {s.state_code} • {new Date(s.created_at).toLocaleString()}</div>
                                            <div className="text-xs mt-2">Status: <strong>{s.status}</strong></div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a href={s.id_document_url} target="_blank" rel="noreferrer" className="btn btn--outline text-xs">ID</a>
                                            {s.breeder_license_url ? <a href={s.breeder_license_url} target="_blank" rel="noreferrer" className="btn btn--outline text-xs">License</a> : null}
                                            <button className="btn btn--success text-xs" onClick={() => handleApprove(s.id)} disabled={actioning === s.id}>
                                                {actioning === s.id ? 'Working…' : 'Approve'}
                                            </button>
                                            <button className="btn btn--danger text-xs" onClick={() => handleReject(s.id)} disabled={actioning === s.id}>
                                                {actioning === s.id ? 'Working…' : 'Reject'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </main>

                <footer className="dashboard-footer">Admin actions are audited. Use responsibly.</footer>
            </div>
        </div>
    );
}
