"use client";

import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiPost } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { useNotifications } from "@/hooks/useNotifications";
import { useCallback, useState } from "react";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const {
    notifications: items,
    loading,
    error,
    next,
    loadMore,
    loadingMore,
    refresh,
    count,
    unreadCount,
  } = useNotifications();
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const handleMarkRead = useCallback(
    async (notificationId: number, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (!accessToken) return;
      try {
        setUpdatingId(notificationId);
        await apiPost(`/notifications/${notificationId}/mark_read/`, undefined, {
          token: accessToken,
          cache: "no-store",
        });
        await refresh();
      } catch (err) {
        console.error(err);
        toast.show("Unable to mark notification. Please try again.", "error");
      } finally {
        setUpdatingId(null);
      }
    },
    [accessToken, refresh, toast]
  );

  const handleMarkAllRead = async () => {
    if (!accessToken || unreadCount === 0) return;
    try {
      setMarkingAll(true);
      await apiPost("/notifications/mark_all_read/", undefined, {
        token: accessToken,
        cache: "no-store",
      });
      await refresh();
    } catch (err) {
      console.error(err);
      toast.show("Unable to mark all notifications. Please try again.", "error");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.unread) {
      await handleMarkRead(notification.id);
    }
    if (notification.target_post_id) {
      router.push(`/app/feed/${notification.target_post_id}`);
    }
  };

  const getNotificationMessage = (notification: Notification): string => {
    if (notification.verb === "commented") {
      return "commented on your post";
    } else if (notification.verb === "reacted") {
      return "reacted to your post";
    } else if (notification.verb === "comment_replied") {
      return "replied to your comment";
    } else if (notification.verb === "friend_request") {
      return "sent you a friend request";
    } else if (notification.verb === "friend_request_accepted") {
      return "accepted your friend request";
    } else if (notification.verb === "messaged") {
      return "sent you a message";
    }
    return notification.verb;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-300">Notifications</h1>
          <p className="text-sm text-gray-500">
            {count === 0 ? "Nothing new right now." : `${count} notification${count === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={refresh}
            className="rounded-full border border-white/40 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Refresh
          </button>
          <button
            onClick={handleMarkAllRead}
            disabled={!accessToken || unreadCount === 0 || markingAll}
            className="rounded-full border border-[var(--color-deep-navy)] px-4 py-1.5 text-sm font-semibold text-[var(--color-deep-navy)] transition hover:bg-[var(--color-deep-navy)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {markingAll ? "Marking..." : unreadCount ? `Mark all as read (${unreadCount})` : "All caught up"}
          </button>
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
            className="mt-4 rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">You&apos;re up to date.</h2>
          <p className="mt-2 text-sm text-gray-500">
            We&apos;ll let you know when something happens.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((notification) => {
              const actorLabel =
                notification.actor.username ||
                [notification.actor.first_name, notification.actor.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                notification.actor.email;
              const message = getNotificationMessage(notification);
              const hasPostLink = notification.target_post_id !== null && notification.target_post_id !== undefined;

              return (
                <li
                  key={notification.id}
                  className={`flex items-start gap-4 rounded-[16px] border border-gray-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm transition ${
                    hasPostLink ? "cursor-pointer hover:shadow-md hover:border-[var(--color-primary)]/40" : ""
                  }`}
                  onClick={() => hasPostLink && handleNotificationClick(notification)}
                >
                  <div
                    className={`mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                      notification.unread ? "bg-[var(--color-rich-red-top)]" : "bg-gray-300"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold text-[var(--color-deep-navy)]">{actorLabel}</span>{" "}
                      {message}
                    </p>
                    {notification.target_post_preview && (
                      <p className="mt-1.5 text-xs text-gray-600 italic line-clamp-2">
                        "{notification.target_post_preview}"
                      </p>
                    )}
                    {notification.target_comment_preview && (
                      <p className="mt-1.5 text-xs text-gray-600 line-clamp-2">
                        Comment: "{notification.target_comment_preview}"
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-500">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                  {notification.unread && (
                    <button
                      onClick={(e) => handleMarkRead(notification.id, e)}
                      disabled={updatingId === notification.id}
                      className="rounded-lg border border-[var(--color-deep-navy)] px-3 py-1.5 text-xs font-semibold text-[var(--color-deep-navy)] transition hover:bg-[var(--color-deep-navy)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 flex-shrink-0"
                    >
                      {updatingId === notification.id ? "Marking..." : "Mark as read"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {next && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-[var(--color-deep-navy)] px-5 py-2 text-sm font-semibold text-[var(--color-deep-navy)] transition hover:bg-[var(--color-deep-navy)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
