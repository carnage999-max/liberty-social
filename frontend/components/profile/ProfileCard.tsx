"use client";

import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/useProfile";

export default function ProfileCard() {
  const { logout, loading: authLoading } = useAuth();
  const { data, loading, error } = useProfile();

  return (
    <div className="rounded-[16px] bg-white/80 backdrop-blur-sm shadow-md p-4 sm:p-6">
      <h3 className="text-lg font-bold">Profile</h3>

      {loading && <p className="mt-3 text-gray-500 animate-pulse">Loading…</p>}
      {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}

      {data && (
        <div className="mt-4 space-y-2 text-sm">
          <div><span className="font-medium">Username:</span> {data.username}</div>
          {data.first_name || data.last_name ? (
            <div><span className="font-medium">Name:</span> {data.first_name} {data.last_name}</div>
          ) : null}
          {data.email ? (
            <div><span className="font-medium">Email:</span> {data.email}</div>
          ) : null}
        </div>
      )}

      <button
        onClick={logout}
        disabled={authLoading}
        className="mt-6 w-full rounded-[10px] px-4 py-2.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white font-semibold hover:opacity-90 transition shadow-metallic disabled:opacity-60"
      >
        {authLoading ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
