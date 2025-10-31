"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiPost } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import { useState } from "react";
import { useToast } from "@/components/Toast";

export default function NotificationsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const {
    items,
    loading,
    error,
    next,
    loadMore,
    loadingMore,
    refresh,
    count,
  } = usePaginatedResource<Notification>("/notifications/");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const handleMarkRead = async (notificationId: number) => {
    if (!accessToken) return;
    try {
      setUpdatingId(notificationId);
      await apiPost(`/notifications/${notificationId}/mark_read/`, undefined, {
        token: accessToken,
        cache: "no-store",
      });
      await refresh();
      toast.show("Notification marked as read.");
    } catch (err) {
      console.error(err);
      toast.show("Unable to mark notification. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <RequireAuth>
      <section className="min-h-screen bg-[var(--color-background)] pb-12 pt-24 sm:pt-28">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">
              {count === 0
                ? "Nothing new right now."
                : `${count} notification${count === 1 ? "" : "s"}`}
            </p>
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
                Youâ€™re up to date.
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Weâ€™ll let you know when something happens.
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {items.map((notification) => (
                  <li
                    key={notification.id}
                    className="flex items-start gap-4 rounded-[16px] border border-gray-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm"
                  >
                    <div
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        notification.unread
                          ? "bg-[var(--color-secondary)]"
                          : "bg-gray-300"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">
                        <span className="font-semibold text-[var(--color-primary)]">
                          {notification.actor.username ||
                            `${notification.actor.first_name ?? ""} ${
                              notification.actor.last_name ?? ""
                            }`.trim() ||
                            notification.actor.email}
                        </span>{" "}
                        {notification.verb}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    {notification.unread && (
                      <button
                        onClick={() => handleMarkRead(notification.id)}
                        disabled={updatingId === notification.id}
                        className="rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingId === notification.id
                          ? "Marking..."
                          : "Mark as read"}
                      </button>
                    )}
                  </li>
                ))}
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





