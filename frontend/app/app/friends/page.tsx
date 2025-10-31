"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import {
  apiDelete,
} from "@/lib/api";
import type { Friend } from "@/lib/types";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/Toast";

export default function FriendsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const { items, loading, error, loadMore, loadingMore, next, refresh, count } =
    usePaginatedResource<Friend>("/auth/friends/");
  const [removingId, setRemovingId] = useState<number | null>(null);

  const handleRemove = async (friendId: number) => {
    if (!accessToken) return;
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
      toast.show("Unable to remove friend. Please try again.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <RequireAuth>
      <section className="min-h-screen bg-[var(--color-background)] pb-12 pt-24 sm:pt-28">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <header className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
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
                className="mt-4 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800">
                You havenâ€™t added any friends yet.
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
                              alt={friend.username || friend.email}
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-base font-semibold text-gray-600">
                              {(friend.username || friend.email)?.[0]?.toUpperCase() || "U"}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {friend.username ||
                              `${friend.first_name ?? ""} ${friend.last_name ?? ""}`.trim() ||
                              friend.email}
                          </p>
                          <p className="text-xs text-gray-500">
                            Friends since {new Date(friendship.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/app/profile/${friend.id}`}
                          className="rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white"
                        >
                          View profile
                        </Link>
                        <button
                          onClick={() => handleRemove(friendship.id)}
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






