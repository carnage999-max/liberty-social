"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiPost } from "@/lib/api";
import type { FriendRequest } from "@/lib/types";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";

type Tab = "incoming" | "outgoing" | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Sent" },
  { id: "all", label: "All" },
];

export default function FriendRequestsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("incoming");

  const query = useMemo(() => {
    if (activeTab === "all") return {};
    return { direction: activeTab };
  }, [activeTab]);

  const {
    items,
    loading,
    error,
    next,
    loadMore,
    loadingMore,
    refresh,
    count,
  } = usePaginatedResource<FriendRequest>("/auth/friend-requests/", {
    query,
  });

  const [pendingAction, setPendingAction] = useState<number | null>(null);

  const handleAction = async (
    requestId: number,
    action: "accept" | "decline" | "cancel"
  ) => {
    if (!accessToken) return;
    try {
      setPendingAction(requestId);
      const suffix =
        action === "accept"
          ? "accept-friend-request"
          : action === "decline"
          ? "decline"
          : "cancel";
      await apiPost(`/auth/friend-requests/${requestId}/${suffix}/`, undefined, {
        token: accessToken,
        cache: "no-store",
      });
      await refresh();
      const message =
        action === "accept"
          ? "Friend request accepted."
          : action === "decline"
          ? "Friend request declined."
          : "Friend request cancelled.";
      toast.show(message);
    } catch (err) {
      console.error(err);
      toast.show("Something went wrong. Please try again.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <RequireAuth>
      <section className="min-h-screen bg-[var(--color-background)] pb-12 pt-24 sm:pt-28">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Friend requests</h1>
              <p className="text-sm text-gray-500">
                {count === 0
                  ? "No pending requests"
                  : `${count} request${count === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex gap-2 rounded-[12px] bg-white/90 p-1 shadow-sm backdrop-blur-sm">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow"
                      : "text-[var(--color-primary)] hover:bg-[var(--metallic-silver)]/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </header>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-white/90 p-8 text-center shadow-sm">
              <p className="text-sm text-gray-700">{error}</p>
              <button
                onClick={() => refresh()}
                className="mt-4 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800">
                You&apos;re all caught up!
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                No friend requests in this view.
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-4">
                {items.map((request) => {
                  const rawUser =
                    activeTab === "outgoing"
                      ? (request.to_user as FriendRequest["from_user"] | string)
                      : (request.from_user as FriendRequest["from_user"] | string);

                  const displayUser =
                    typeof rawUser === "object" && rawUser !== null
                      ? rawUser
                      : null;

                  const fallbackLabel = displayUser
                    ? displayUser.username ||
                      `${displayUser.first_name ?? ""} ${
                        displayUser.last_name ?? ""
                      }`.trim() ||
                      displayUser.email ||
                      "User"
                    : rawUser
                    ? `User ${(rawUser as string).slice(0, 8)}...`
                    : "User";

                  const avatarInitial = displayUser
                    ? (displayUser.username || displayUser.email || "U")
                        ?.charAt(0)
                        .toUpperCase() || "U"
                    : rawUser
                    ? (rawUser as string).charAt(0).toUpperCase()
                    : "U";

                  return (
                    <li
                      key={request.id}
                      className="flex items-center justify-between gap-4 rounded-[16px] border border-gray-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                          {displayUser?.profile_image_url ? (
                            <Image
                              src={displayUser.profile_image_url}
                              alt={displayUser.username || displayUser.email}
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-base font-semibold text-gray-600">
                              {avatarInitial}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {fallbackLabel}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(request.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeTab !== "outgoing" && (
                          <button
                            onClick={() => handleAction(request.id, "accept")}
                            disabled={pendingAction === request.id}
                            className="rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-3 py-1.5 text-xs font-semibold text-white shadow hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pendingAction === request.id
                              ? "Processing..."
                              : "Accept"}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleAction(
                              request.id,
                              activeTab === "outgoing" ? "cancel" : "decline"
                            )
                          }
                          disabled={pendingAction === request.id}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingAction === request.id
                            ? "Processing..."
                            : activeTab === "outgoing"
                            ? "Cancel"
                            : "Decline"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {next && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-lg border border-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </RequireAuth>
  );
}





