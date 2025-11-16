"use client";

import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiPost } from "@/lib/api";
import type { Friend, User } from "@/lib/types";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { useRouter } from "next/navigation";

export default function FriendsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const toast = useToast();
  const { items, loading, error, loadMore, loadingMore, next, refresh, count } =
    usePaginatedResource<Friend>("/auth/friends/");
  const {
    items: suggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
    loadMore: loadMoreSuggestions,
    loadingMore: loadingMoreSuggestions,
    next: nextSuggestions,
    refresh: refreshSuggestions,
  } = usePaginatedResource<User>("/auth/friends/suggestions/");
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null);

  const handleRemoveClick = (friend: Friend) => {
    setFriendToRemove(friend);
  };

  const handleRemove = async () => {
    if (!accessToken || !friendToRemove) return;
    const friendId = friendToRemove.id;
    setFriendToRemove(null);
    try {
      setRemovingId(friendId);
      await apiDelete(`/auth/friends/${friendId}/`, {
        token: accessToken,
        cache: "no-store",
      });
      await refresh();
      toast.show("Friend removed.");
    } catch (err) {
      console.error(err);
      toast.show("Unable to remove friend. Please try again.", "error");
    } finally {
      setRemovingId(null);
    }
  };

  const sendRequest = async (userId: string) => {
    if (!accessToken) return;
    try {
      setRequestingId(userId);
      await apiPost(
        "/auth/friend-requests/",
        { to_user_id: userId },
        {
          token: accessToken,
          cache: "no-store",
        }
      );
      toast.show("Friend request sent.");
      await refreshSuggestions();
    } catch (err) {
      console.error(err);
      toast.show("Unable to send request. Please try again.", "error");
    } finally {
      setRequestingId(null);
    }
  };

  const handleDismissSuggestion = async (userId: string) => {
    if (!accessToken) return;
    try {
      setDismissingId(userId);
      await apiPost(
        "/auth/dismissed-suggestions/",
        { dismissed_user_id: userId },
        {
          token: accessToken,
          cache: "no-store",
        }
      );
      await refreshSuggestions();
    } catch (err) {
      console.error(err);
      toast.show("Unable to dismiss suggestion. Please try again.", "error");
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-gray-300">Friends</h1>
        <p className="text-sm text-gray-500">
          {count === 0 ? "No friends yet." : `${count} connection${count === 1 ? "" : "s"}`}
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
            className="mt-4 rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">
            You haven&apos;t added any friends yet.
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Send friend requests to connect with people you know.
          </p>
        </div>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((friendship) => {
              const friend = friendship.friend;
              const displayName =
                friend.username ||
                [friend.first_name, friend.last_name].filter(Boolean).join(" ") ||
                friend.email;
              return (
                <li
                  key={friendship.id}
                  className="flex items-center justify-between gap-4 rounded-[16px] border border-gray-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                      {friend.profile_image_url ? (
                        <Image
                          src={friend.profile_image_url}
                          alt={displayName}
                          width={48}
                          height={48}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-base font-semibold text-gray-600">
                          {(displayName || "U")[0]?.toUpperCase() || "U"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-500">
                        Friends since {new Date(friendship.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {friend.id && friend.id !== "undefined" ? (
                      <Link
                        href={`/app/users/${friend.id}`}
                        className="rounded-lg border border-(--color-deep-navy) px-3 py-1.5 text-xs font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white"
                      >
                        View profile
                      </Link>
                    ) : null}
                    <button
                      onClick={() => handleRemoveClick(friendship)}
                      disabled={removingId === friendship.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {removingId === friendship.id ? "Removing..." : "Remove"}
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
                className="rounded-lg border border-(--color-deep-navy) px-5 py-2 text-sm font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}

      <section className="space-y-4 rounded-[18px] border border-gray-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">People you may know</h2>
            <p className="text-sm text-gray-500">
              Discover new connections based on recent sign-ups and shared networks.
            </p>
          </div>
          {nextSuggestions && (
            <button
              onClick={loadMoreSuggestions}
              disabled={loadingMoreSuggestions}
              className="self-start rounded-lg border border-(--color-deep-navy) px-4 py-2 text-xs font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMoreSuggestions ? "Loading..." : "Load more"}
            </button>
          )}
        </div>

        {suggestionsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : suggestionsError ? (
          <div className="rounded-[14px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {suggestionsError}
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-gray-500">You&apos;re already connected with most people. Check back later for new suggestions.</p>
        ) : (
          <ul className="space-y-4">
            {suggestions.map((suggestion) => {
              const displayName =
                suggestion.username ||
                [suggestion.first_name, suggestion.last_name].filter(Boolean).join(" ") ||
                suggestion.email;
              return (
                <li
                  key={suggestion.id}
                  className="flex items-center justify-between gap-4 rounded-[16px] border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <button
                    onClick={() => suggestion.id && router.push(`/app/users/${suggestion.id}`)}
                    className="flex items-center gap-3 flex-1 text-left transition hover:opacity-80"
                  >
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                      {suggestion.profile_image_url ? (
                        <Image
                          src={suggestion.profile_image_url}
                          alt={displayName}
                          width={48}
                          height={48}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-base font-semibold text-gray-600">
                          {(displayName || "U")[0]?.toUpperCase() || "U"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-500">
                        Joined {suggestion.date_joined ? new Date(suggestion.date_joined).toLocaleDateString() : "recently"}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => sendRequest(suggestion.id)}
                      disabled={requestingId === suggestion.id}
                      className="rounded-full bg-(--color-gold) border-2 border-(--color-gold) w-9 h-9 flex items-center justify-center transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Add friend"
                      aria-label="Add friend"
                    >
                      {requestingId === suggestion.id ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 animate-spin text-gray-800"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-gray-800"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDismissSuggestion(suggestion.id)}
                      disabled={dismissingId === suggestion.id}
                      className="rounded-full bg-(--color-rich-red-top) border-2 border-(--color-gold) w-9 h-9 flex items-center justify-center transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Dismiss suggestion"
                      aria-label="Dismiss suggestion"
                    >
                      {dismissingId === suggestion.id ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 animate-spin text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {suggestions.length > 0 && !nextSuggestions && (
          <p className="text-xs text-gray-500">That&apos;s everyone for now. We&apos;ll suggest more people soon.</p>
        )}
      </section>
      <ConfirmationDialog
        isOpen={friendToRemove !== null}
        title="Remove Friend"
        message={
          friendToRemove
            ? `Are you sure you want to remove ${friendToRemove.friend.username || friendToRemove.friend.first_name || "this friend"}? You will no longer see each other's posts.`
            : ""
        }
        confirmText="Remove"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleRemove}
        onCancel={() => setFriendToRemove(null)}
      />
    </div>
  );
}
