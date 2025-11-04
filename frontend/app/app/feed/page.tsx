"use client";

import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiGet, apiGetUrl, apiPost, type PaginatedResponse } from "@/lib/api";
import type { Post, Reaction } from "@/lib/types";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { PostActionsMenu } from "@/components/feed/PostActionsMenu";
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
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [pagination, setPagination] = useState<
    Pick<PaginatedResponse<FeedPost>, "count" | "next">
  >({ count: 0, next: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReactions, setPendingReactions] = useState<Set<number>>(() => new Set());
  const controllerRef = useRef<AbortController | null>(null);
  const pendingReactionsRef = useRef<Set<number>>(new Set());
  const [gallery, setGallery] = useState<{ postId: number; index: number } | null>(null);

  useEffect(() => {
    pendingReactionsRef.current = pendingReactions;
  }, [pendingReactions]);

  const updatePendingReaction = useCallback((postId: number, add: boolean) => {
    setPendingReactions((prev) => {
      const next = new Set(prev);
      if (add) next.add(postId);
      else next.delete(postId);
      pendingReactionsRef.current = next;
      return next;
    });
  }, []);

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

  const handleLoadMore = useCallback(() => {
    if (!pagination.next) return;
    loadFeed(pagination.next, true);
  }, [pagination.next, loadFeed]);

  const handlePostUpdated = useCallback((updated: Post) => {
    setPosts((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
  }, []);

  const handlePostDeleted = useCallback((postId: number) => {
    setPosts((prev) => prev.filter((item) => item.id !== postId));
    setPagination((prev) => ({
      ...prev,
      count: prev.count > 0 ? prev.count - 1 : 0,
    }));
  }, []);

  const openGallery = useCallback((postId: number, index: number) => {
    setGallery({ postId, index });
  }, []);

  const handleCommentsNavigate = useCallback(
    (postId: number) => {
      const url = new URL(`/app/feed/${postId}`, window.location.origin);
      url.hash = "comments";
      window.location.assign(url.toString());
    },
    []
  );

  const closeGallery = useCallback(() => {
    setGallery(null);
  }, []);

  const handleGalleryNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (!gallery) return;
      const activePost = posts.find((post) => post.id === gallery.postId);
      if (!activePost) return;
      const media = Array.isArray(activePost.media) ? activePost.media.filter(Boolean) : [];
      if (media.length === 0) return;
      const delta = direction === "prev" ? -1 : 1;
      const nextIndex = (gallery.index + delta + media.length) % media.length;
      setGallery({ postId: gallery.postId, index: nextIndex });
    },
    [gallery, posts]
  );

  useEffect(() => {
    if (!gallery) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeGallery();
      } else if (event.key === "ArrowLeft") {
        handleGalleryNavigate("prev");
      } else if (event.key === "ArrowRight") {
        handleGalleryNavigate("next");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gallery, handleGalleryNavigate, closeGallery]);

  useEffect(() => {
    if (!gallery) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [gallery]);

  const handleToggleReaction = useCallback(
    async (postId: number) => {
      if (!accessToken || !user) {
        toast.show("Sign in to react to posts.", "error");
        return;
      }
      if (pendingReactionsRef.current.has(postId)) return;

      const targetPost = posts.find((item) => item.id === postId);
      if (!targetPost) return;
      const existing = (targetPost.reactions ?? []).find(
        (reaction) => reaction.user?.id === user.id
      );

      updatePendingReaction(postId, true);
      try {
        if (existing) {
          await apiDelete(`/reactions/${existing.id}/`, {
            token: accessToken,
            cache: "no-store",
          });
          setPosts((prev) =>
            prev.map((item) =>
              item.id === postId
                ? {
                    ...item,
                    reactions: (item.reactions ?? []).filter(
                      (reaction) => reaction.id !== existing.id
                    ),
                  }
                : item
            )
          );
        } else {
          const created = (await apiPost(
            "/reactions/",
            { post: postId, reaction_type: "like" },
            {
              token: accessToken,
              cache: "no-store",
            }
          )) as Reaction;
          const normalized = {
            ...created,
            user: created.user ?? user,
          } as Reaction;
          setPosts((prev) =>
            prev.map((item) =>
              item.id === postId
                ? {
                    ...item,
                    reactions: [
                      ...(item.reactions ?? []).filter(
                        (reaction) => reaction.user?.id !== user.id
                      ),
                      normalized,
                    ],
                  }
                : item
            )
          );
        }
      } catch (err) {
        console.error(err);
        const message =
          err instanceof Error && err.message
            ? err.message
            : "We couldn't update your reaction. Please try again.";
        toast.show(message, "error");
      } finally {
        updatePendingReaction(postId, false);
      }
    },
    [accessToken, posts, toast, updatePendingReaction, user]
  );

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
          const mediaUrls = Array.isArray(post.media) ? post.media.filter(Boolean) : [];
          const authorLabel =
            post.author.username ||
            [post.author.first_name, post.author.last_name].filter(Boolean).join(" ") ||
            post.author.email;
          const rawAuthorId = post.author?.id;
          const profileHref =
            rawAuthorId && rawAuthorId !== "undefined" ? `/app/users/${rawAuthorId}` : null;
          const currentUserReaction =
            user && post.reactions
              ? post.reactions.find((reaction) => reaction.user?.id === user.id)
              : undefined;
          const liked = Boolean(currentUserReaction);
          const reactionBusy = pendingReactions.has(post.id);

          return (
            <article
              key={post.id}
              className="rounded-[18px] border border-gray-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition hover:shadow-md sm:p-6"
            >
              <header className="mb-4 flex items-start justify-between gap-3">
                {profileHref ? (
                  <Link href={profileHref} className="flex items-center gap-3 transition hover:opacity-90">
                    <AuthorMeta authorLabel={authorLabel} createdAt={post.created_at} avatarUrl={post.author.profile_image_url} />
                  </Link>
                ) : (
                  <AuthorMeta authorLabel={authorLabel} createdAt={post.created_at} avatarUrl={post.author.profile_image_url} />
                )}
                <PostActionsMenu
                  post={post}
                  accessToken={accessToken}
                  currentUserId={user?.id ?? null}
                  onUpdated={handlePostUpdated}
                  onDeleted={handlePostDeleted}
                />
              </header>

              <Link href={`/app/feed/${post.id}`}>
                <p className="whitespace-pre-line text-sm text-gray-800 sm:text-base">
                  {post.content}
                </p>
              </Link>

              {mediaUrls.length > 0 && (
                <div
                  className={[
                    "mt-4 grid gap-2 sm:gap-3",
                    mediaUrls.length === 1
                      ? "grid-cols-1"
                      : mediaUrls.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-3",
                  ].join(" ")}
                >
                  {mediaUrls.slice(0, 9).map((url, index) => (
                    <button
                      key={`${post.id}-media-${index}`}
                      type="button"
                      onClick={() => openGallery(post.id, index)}
                      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                    >
                      <Image
                        src={url}
                        alt={`Media ${index + 1} from ${authorLabel}`}
                        width={640}
                        height={480}
                        loading="lazy"
                        sizes={
                          mediaUrls.length === 1
                            ? "(min-width: 768px) 640px, 100vw"
                            : "(min-width: 1280px) 360px, (min-width: 768px) 45vw, 100vw"
                        }
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                    </button>
                  ))}
                </div>
              )}

              <footer className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <button
                  type="button"
                  onClick={() => handleToggleReaction(post.id)}
                  aria-pressed={liked}
                  disabled={reactionBusy}
                  aria-label={liked ? "Remove your reaction" : "React to this post"}
                  className={[
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition disabled:cursor-not-allowed",
                    liked
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      : "border-gray-200 text-gray-600 hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]",
                    reactionBusy ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={liked ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {reactionSummary.total}
                </button>
                <button
                  type="button"
                  onClick={() => handleCommentsNavigate(post.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-600 transition hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                  aria-label="View comments"
                >
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
                </button>
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
    <>
      <div className="space-y-6">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-400">Your Feed</h1>
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

      {gallery && (
        <GalleryModal
          posts={posts}
          state={gallery}
          onClose={closeGallery}
          onNavigate={handleGalleryNavigate}
          onSelect={(index) => setGallery((prev) => (prev ? { ...prev, index } : prev))}
        />
      )}
    </>
  );
}

type GalleryModalProps = {
  posts: FeedPost[];
  state: { postId: number; index: number };
  onClose: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onSelect: (index: number) => void;
};

function GalleryModal({ posts, state, onClose, onNavigate, onSelect }: GalleryModalProps) {
  const activePost = posts.find((post) => post.id === state.postId);
  const media = activePost && Array.isArray(activePost.media) ? activePost.media.filter(Boolean) : [];
  const authorLabel =
    activePost?.author.username ||
    [activePost?.author.first_name, activePost?.author.last_name].filter(Boolean).join(" ") ||
    activePost?.author.email ||
    "Post image";

  if (!activePost || media.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10 sm:px-6"
    >
      <div className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white/95 shadow-2xl backdrop-blur">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">{authorLabel}</p>
            <p className="text-xs text-gray-500">
              {new Date(activePost.created_at).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close gallery"
            className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M6 18L18 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="relative flex flex-1 items-center justify-center bg-gray-900">
          <button
            type="button"
            onClick={() => onNavigate("prev")}
            aria-label="Previous image"
            className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-lg transition hover:bg-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="relative h-full w-full min-h-[260px] sm:min-h-[360px]">
            <Image
              key={media[state.index]}
              src={media[state.index]}
              alt={`Gallery image ${state.index + 1}`}
              fill
              sizes="(min-width: 1024px) 768px, 90vw"
              priority
              className="object-contain"
            />
          </div>

          <button
            type="button"
            onClick={() => onNavigate("next")}
            aria-label="Next image"
            className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-lg transition hover:bg-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 18l6-6-6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <footer className="flex flex-col gap-4 px-6 py-4">
          <div className="flex items-center justify-center gap-2">
            {media.map((_, index) => (
              <button
                key={`dot-${index}`}
                type="button"
                aria-label={`View image ${index + 1}`}
                onClick={() => onSelect(index)}
                className={[
                  "h-2.5 rounded-full transition",
                  index === state.index
                    ? "w-6 bg-[var(--color-primary)]"
                    : "w-2.5 bg-gray-300 hover:bg-gray-400",
                ].join(" ")}
              />
            ))}
          </div>
          <p className="text-center text-xs text-gray-500">
            {state.index + 1} of {media.length}
          </p>
        </footer>
      </div>
    </div>
  );
}
function AuthorMeta({
  authorLabel,
  createdAt,
  avatarUrl,
}: {
  authorLabel: string | null | undefined;
  createdAt: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gray-100">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={authorLabel || "Profile picture"}
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm font-semibold text-gray-600">
            {(authorLabel || "U")?.[0]?.toUpperCase() || "U"}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{authorLabel}</p>
        <p className="text-xs text-gray-500">{new Date(createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}
