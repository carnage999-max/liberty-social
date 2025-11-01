"use client";

import { useAuth } from "@/lib/auth-context";
import { apiGet, apiGetUrl, type PaginatedResponse } from "@/lib/api";
import type { Post, Reaction } from "@/lib/types";
import Spinner from "@/components/Spinner";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FeedPost = Post;

type ReactionSummary = {
  total: number;
  byType: Record<Reaction["reaction_type"], number>;
};

function summariseReactions(reactions: Reaction[]): ReactionSummary {
  const summary: ReactionSummary = {
    total: reactions.length,
    byType: {
      like: 0,
      love: 0,
      haha: 0,
      sad: 0,
      angry: 0,
    },
  };
  for (const reaction of reactions) {
    summary.byType[reaction.reaction_type] += 1;
  }
  return summary;
}

const COMMUNITY_SUGGESTIONS = [
  {
    title: "Digital Creators",
    description: "Swap ideas on storytelling, editing, and growth tactics.",
  },
  {
    title: "Product Thinkers",
    description: "Explore feature concepts with fellow builders.",
  },
  {
    title: "Mindful Mondays",
    description: "Weekly check-ins for balance, focus, and calm.",
  },
];

export default function FeedPage() {
  const { accessToken } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [pagination, setPagination] = useState<
    Pick<PaginatedResponse<FeedPost>, "count" | "next">
  >({ count: 0, next: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const loadFeed = useCallback(
    async (url?: string, append = false) => {
      if (!accessToken) return;
      const controller = new AbortController();
      controllerRef.current?.abort();
      controllerRef.current = controller;
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);

        const data = await (url
          ? apiGetUrl<PaginatedResponse<FeedPost>>(url, {
              token: accessToken,
              cache: "no-store",
              signal: controller.signal,
            })
          : apiGet<PaginatedResponse<FeedPost>>("/feed/", {
              token: accessToken,
              cache: "no-store",
              signal: controller.signal,
            }));

        const normalisedResults = data.results ?? [];
        setPosts((prev) =>
          append ? [...prev, ...normalisedResults] : normalisedResults
        );
        setPagination({ count: data.count ?? normalisedResults.length, next: data.next });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error(err);
        setError(err?.message || "Could not load your feed right now.");
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (!accessToken) return;
    loadFeed();
    return () => {
      controllerRef.current?.abort();
    };
  }, [accessToken, loadFeed]);

  useEffect(() => {
    const handler = () => {
      loadFeed();
    };
    window.addEventListener("post:created", handler);
    return () => {
      window.removeEventListener("post:created", handler);
    };
  }, [loadFeed]);

  const canLoadMore = !!pagination.next;
  const feedCountLabel = useMemo(() => {
    if (pagination.count === 0) return "No posts yet";
    if (pagination.count === 1) return "1 post";
    return `${pagination.count} posts`;
  }, [pagination.count]);

  const handleLoadMore = useCallback(() => {
    if (!pagination.next) return;
    loadFeed(pagination.next, true);
  }, [pagination.next, loadFeed]);

  const renderPosts = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl bg-white/90 p-8 text-center shadow-sm">
          <p className="text-sm text-gray-700">{error}</p>
          <button
            onClick={() => loadFeed()}
            className="mt-4 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
          >
            Retry
          </button>
        </div>
      );
    }

    if (posts.length === 0) {
      return (
        <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
          <Image
            src="/assets/empty-state.svg"
            alt="Empty feed"
            width={180}
            height={180}
            className="mx-auto mb-4 opacity-90"
          />
          <h2 className="text-lg font-semibold text-gray-800">Your feed is waiting.</h2>
          <p className="mt-2 text-sm text-gray-500">
            Follow friends or join communities to see posts here.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {posts.map((post) => {
          const reactionSummary = summariseReactions(post.reactions ?? []);
          const firstMedia = post.media?.[0];
          const authorLabel =
            post.author.username ||
            [post.author.first_name, post.author.last_name].filter(Boolean).join(" ") ||
            post.author.email;

          return (
            <article
              key={post.id}
              className="rounded-[18px] border border-gray-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition hover:shadow-md sm:p-6"
            >
              <header className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                  {post.author.profile_image_url ? (
                    <Image
                      src={post.author.profile_image_url}
                      alt={authorLabel}
                      width={44}
                      height={44}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-gray-600">
                      {(authorLabel || "U")[0]?.toUpperCase() || "U"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{authorLabel}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
              </header>

              <Link href={`/app/feed/${post.id}`}>
                <p className="whitespace-pre-line text-sm text-gray-800 sm:text-base">
                  {post.content}
                </p>
              </Link>

              {firstMedia && (
                <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
                  <Image
                    src={firstMedia}
                    alt="Post media"
                    width={1024}
                    height={512}
                    className="h-auto w-full object-cover"
                  />
                </div>
              )}

              <footer className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z"
                      fill="currentColor"
                    />
                  </svg>
                  {reactionSummary.total}
                </span>
                <span className="flex items-center gap-1">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 0117 0z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {post.comments?.length ?? 0}
                </span>
                {reactionSummary.total > 0 && (
                  <div className="hidden gap-3 text-xs text-gray-500 sm:flex">
                    {Object.entries(reactionSummary.byType)
                      .filter(([, value]) => value > 0)
                      .map(([type, value]) => (
                        <span key={type}>
                          {type}: {value}
                        </span>
                      ))}
                  </div>
                )}
              </footer>
            </article>
          );
        })}

        {canLoadMore && (
          <div className="flex justify-center pt-2">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-lg border border-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : "Load more posts"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Feed</h1>
          <p className="text-sm text-gray-500">{feedCountLabel}</p>
        </div>
      </header>

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="flex-1">{renderPosts()}</div>

        <aside className="hidden xl:block xl:w-[280px] xl:flex-shrink-0">
          <div className="space-y-6 xl:sticky xl:top-36">
            <div className="rounded-[16px] bg-white/85 p-4 shadow-sm backdrop-blur-sm">
              <h2 className="text-sm font-semibold text-gray-800">Community suggestions</h2>
              <ul className="mt-4 space-y-3 text-sm text-gray-600">
                {COMMUNITY_SUGGESTIONS.map((community) => (
                  <li
                    key={community.title}
                    className="rounded-lg border border-gray-100 bg-white/70 p-3 shadow-sm"
                  >
                    <h3 className="font-semibold text-[var(--color-primary)]">
                      {community.title}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">{community.description}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[16px] bg-white/85 p-4 shadow-sm backdrop-blur-sm">
              <h2 className="text-sm font-semibold text-gray-800">Tips</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-gray-600">
                <li>Keep your posts public to reach new communities.</li>
                <li>Save favourite threads to find them in bookmarks.</li>
                <li>Update privacy settings to control who sees you.</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
