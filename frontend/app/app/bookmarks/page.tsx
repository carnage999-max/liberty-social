"use client";

import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiGet } from "@/lib/api";
import type { Bookmark, Post } from "@/lib/types";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";

type PostMap = Record<number, Post>;

export default function BookmarksPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const { items, loading, error, next, loadMore, loadingMore, refresh, count } =
    usePaginatedResource<Bookmark>("/bookmarks/");
  const [postsById, setPostsById] = useState<PostMap>({});
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken || items.length === 0) return;
    const missingIds = items
      .map((bookmark) => bookmark.post)
      .filter((postId) => !postsById[postId]);
    if (missingIds.length === 0) return;

    const controller = new AbortController();
    (async () => {
      try {
        const fetched = await Promise.all(
          missingIds.map((postId) =>
            apiGet<Post>(`/posts/${postId}/`, {
              token: accessToken,
              cache: "no-store",
              signal: controller.signal,
            }).catch(() => null)
          )
        );
        setPostsById((prev) => {
          const nextMap = { ...prev };
          fetched.forEach((post) => {
            if (post) nextMap[post.id] = post;
          });
          return nextMap;
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
      }
    })();
    return () => controller.abort();
  }, [accessToken, items, postsById]);

  const enrichedBookmarks = useMemo(
    () =>
      items.map((bookmark) => ({
        ...bookmark,
        post: postsById[bookmark.post],
      })),
    [items, postsById]
  );

  const handleRemove = async (bookmarkId: number) => {
    if (!accessToken) return;
    try {
      setRemovingId(bookmarkId);
      await apiDelete(`/bookmarks/${bookmarkId}/`, {
        token: accessToken,
        cache: "no-store",
      });
      await refresh();
      toast.show("Bookmark removed.");
    } catch (err) {
      console.error(err);
      toast.show("Unable to remove bookmark. Please try again.", "error");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold --color-silver-mid">Bookmarks</h1>
        <p className="text-sm text-gray-500">
          {count === 0 ? "You haven't saved anything yet." : `${count} bookmark${count === 1 ? "" : "s"}`}
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
            className="mt-4 rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
          >
            Retry
          </button>
        </div>
      ) : enrichedBookmarks.length === 0 ? (
        <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Nothing saved yet.</h2>
          <p className="mt-2 text-sm text-gray-500">
            You can bookmark posts to revisit them later.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {enrichedBookmarks.map((bookmark) => {
              const post = bookmark.post;
              const authorLabel =
                post?.author.username ||
                [post?.author.first_name, post?.author.last_name].filter(Boolean).join(" ") ||
                post?.author.email ||
                "User";
              return (
                <li
                  key={bookmark.id}
                  className="rounded-[18px] border border-gray-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-gray-400">
                        Saved {new Date(bookmark.created_at).toLocaleString()}
                      </p>
                      {post ? (
                        <>
                          <h2 className="mt-1 text-sm font-semibold text-gray-900">{authorLabel}</h2>
                          <p className="mt-2 line-clamp-3 text-sm text-gray-700">{post.content}</p>
                          {post.media && post.media.length > 0 && (
                            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
                              <Image
                                src={post.media[0]}
                                alt="Post media"
                                width={800}
                                height={400}
                                className="h-auto w-full object-cover"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">This post is no longer available.</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleRemove(bookmark.id)}
                        disabled={removingId === bookmark.id}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingId === bookmark.id ? "Removing..." : "Remove"}
                      </button>
                      {post && (
                        <Link
                          href={`/app/feed/${post.id}`}
                          className="rounded-lg border border-(--color-deep-navy) px-3 py-1.5 text-xs font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white"
                        >
                          View post
                        </Link>
                      )}
                    </div>
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
    </div>
  );
}



