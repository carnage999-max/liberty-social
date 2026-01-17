"use client";

import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiGet, apiGetUrl, apiPost, type PaginatedResponse } from "@/lib/api";
import type { Post, Reaction, PageSummary } from "@/lib/types";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { PostActionsMenu } from "@/components/feed/PostActionsMenu";
import { ReactionPicker } from "@/components/feed/ReactionPicker";
import { ReactionsModal } from "@/components/feed/ReactionsModal";
import ShareModal from "@/components/modals/ShareModal";
import ImageGallery from "@/components/ImageGallery";
import FeedFilterTabs from "@/components/FeedFilterTabs";
import FeedBackgroundModal from "@/components/modals/FeedBackgroundModal";
import LinkifiedPostContent from "@/components/LinkifiedPostContent";
import { useFeedBackground } from "@/hooks/useFeedBackground";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";

// Double-tap to like state
type DoubleTapState = {
  postId: number;
  show: boolean;
};

type FeedPost = Post;

// Background theme class mapping
const BACKGROUND_CLASSES: Record<string, string> = {
  default: '',
  american: 'feed-bg-american',
  christmas: 'feed-bg-christmas',
  halloween: 'feed-bg-halloween',
  clouds: 'feed-bg-clouds',
  nature: 'feed-bg-nature',
  space: 'feed-bg-space',
  ocean: 'feed-bg-ocean',
  forest: 'feed-bg-forest',
  sunset: 'feed-bg-sunset',
  stars: 'feed-bg-stars',
  butterflies: 'feed-bg-butterflies',
  dragons: 'feed-bg-dragons',
  'christmas-trees': 'feed-bg-christmas-trees',
  'music-notes': 'feed-bg-music-notes',
  'pixel-hearts': 'feed-bg-pixel-hearts',
};

// Post card styling based on theme
function getPostCardClasses(theme: string): string {
  const baseClasses = "rounded-[18px] border p-5 shadow-sm backdrop-blur-md transition hover:shadow-md sm:p-6";
  
  switch (theme) {
    case 'default':
      return `${baseClasses} border-gray-100 bg-white/90`;
    case 'american':
      return `${baseClasses} border-red-300/60 bg-white/60 shadow-red-200/30`;
    case 'christmas':
      return `${baseClasses} border-green-300/60 bg-white/60 shadow-green-200/30`;
    case 'halloween':
      return `${baseClasses} border-orange-300/60 bg-white/60 shadow-orange-200/30`;
    case 'clouds':
      return `${baseClasses} border-blue-200/60 bg-white/55 shadow-blue-100/30`;
    case 'nature':
      return `${baseClasses} border-green-200/60 bg-white/60 shadow-green-100/30`;
    case 'space':
      return `${baseClasses} border-purple-300/60 bg-white/65 shadow-purple-200/30`;
    case 'ocean':
      return `${baseClasses} border-cyan-300/60 bg-white/60 shadow-cyan-200/30`;
    case 'forest':
      return `${baseClasses} border-emerald-300/60 bg-white/60 shadow-emerald-200/30`;
    case 'sunset':
      return `${baseClasses} border-orange-200/60 bg-white/60 shadow-orange-100/30`;
    case 'stars':
      return `${baseClasses} border-indigo-300/60 bg-white/65 shadow-indigo-200/30`;
    default:
      return `${baseClasses} border-gray-100 bg-white/90`;
  }
}

// Map old text reaction types to emojis for backward compatibility
const REACTION_TYPE_TO_EMOJI: Record<string, string> = {
  "like": "👍",
  "love": "❤️",
  "haha": "😂",
  "sad": "😢",
  "angry": "😠",
};

// Convert reaction type to emoji (handles both old text types and new emoji types)
function getReactionEmoji(reactionType: string): string {
  // If it's already an emoji (not in the mapping), return as-is
  if (REACTION_TYPE_TO_EMOJI[reactionType]) {
    return REACTION_TYPE_TO_EMOJI[reactionType];
  }
  // Otherwise it's already an emoji, return it
  return reactionType;
}

type ReactionSummary = {
  total: number;
  byType: Record<string, number>; // Now supports any emoji
};

function summariseReactions(reactions: Reaction[]): ReactionSummary {
  const summary: ReactionSummary = {
    total: reactions.length,
    byType: {},
  };
  for (const reaction of reactions) {
    // Convert old text types to emojis, keep new emoji types as-is
    const emoji = getReactionEmoji(reaction.reaction_type);
    summary.byType[emoji] = (summary.byType[emoji] || 0) + 1;
  }
  return summary;
}



export default function FeedPage() {
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { theme: feedBackgroundTheme, changeTheme, mounted } = useFeedBackground();
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
  const [openReactionPickerPostId, setOpenReactionPickerPostId] = useState<number | null>(null);
  const [profileImageGallery, setProfileImageGallery] = useState<{
    image: string;
    title?: string;
  } | null>(null);
  const [suggestedPages, setSuggestedPages] = useState<PageSummary[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalPost, setShareModalPost] = useState<Post | null>(null);
  const [showFriendPosts, setShowFriendPosts] = useState(true);
  const [showPagePosts, setShowPagePosts] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [reactionsModalOpen, setReactionsModalOpen] = useState(false);
  const [reactionsModalData, setReactionsModalData] = useState<Reaction[]>([]);
  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [doubleTapAnimation, setDoubleTapAnimation] = useState<{ postId: number; show: boolean } | null>(null);

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
    async (
      url?: string,
      append = false,
      filters?: { showFriendPosts?: boolean; showPagePosts?: boolean; selectedCategory?: string }
    ) => {
      if (!accessToken) return;
      const controller = new AbortController();
      controllerRef.current?.abort();
      controllerRef.current = controller;
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);

        let finalUrl = url;

        // If no URL provided, build with filters
        if (!url) {
          const params = new URLSearchParams();

          // Get filter values - use passed filters if provided, otherwise use component state
          const showFriend =
            filters?.showFriendPosts !== undefined ? filters.showFriendPosts : showFriendPosts;
          const showPage =
            filters?.showPagePosts !== undefined ? filters.showPagePosts : showPagePosts;
          const category =
            filters?.selectedCategory !== undefined ? filters.selectedCategory : selectedCategory;

          console.log("[FEED] Building request with filters:", {
            showFriend,
            showPage,
            category,
            passedFilters: filters,
            componentFilters: { showFriendPosts, showPagePosts, selectedCategory },
          });

          // Always add filter params if filters are not at default
          // Default is: showFriendPosts=true, showPagePosts=true, no category
          if (showFriend !== true || showPage !== true || category) {
            params.append("show_friend_posts", showFriend.toString());
            params.append("show_page_posts", showPage.toString());
            if (category) {
              params.append("preferred_categories", category);
            }
          }

          finalUrl = `/feed/?${params.toString()}`;
          console.log("[FEED] Final URL:", finalUrl);
        }

        // Use apiGetUrl for pagination URLs (which contain full domain), apiGet for relative paths
        const data = await (finalUrl && finalUrl.startsWith("http")
          ? apiGetUrl<PaginatedResponse<FeedPost>>(finalUrl, {
              token: accessToken,
              cache: "no-store",
              signal: controller.signal,
            })
          : apiGet<PaginatedResponse<FeedPost>>(finalUrl || "/feed/", {
              token: accessToken,
              cache: "no-store",
              signal: controller.signal,
            }));

        console.log("[FEED] Response received:", { count: data.count, results: data.results?.length });

        const normalisedResults = data.results ?? [];
        setPosts((prev) => (append ? [...prev, ...normalisedResults] : normalisedResults));
        setPagination({ count: data.count ?? normalisedResults.length, next: data.next });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("[FEED] Error loading feed:", err);
        setError(err?.message || "Could not load your feed right now.");
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, showFriendPosts, showPagePosts, selectedCategory]
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

  const loadSuggestedPages = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoadingPages(true);
      const response = await apiGet<PaginatedResponse<PageSummary>>(
        "/pages/?limit=10",
        { token: accessToken }
      );
      const pages = response.results || [];
      // Get 3 random pages
      const shuffled = [...pages].sort(() => 0.5 - Math.random());
      setSuggestedPages(shuffled.slice(0, 3));
    } catch (err) {
      console.error("Failed to load suggested pages:", err);
    } finally {
      setLoadingPages(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadSuggestedPages();
  }, [loadSuggestedPages]);

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

  const handlePostNavigate = useCallback(
    (post: Post) => {
      router.push(`/app/feed/${post.slug ?? post.id}`);
    },
    [router]
  );

  const handlePostContentClick = useCallback(
    (event: React.MouseEvent<HTMLElement>, post: Post) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a")) return;
      handlePostNavigate(post);
    },
    [handlePostNavigate]
  );

  const handlePostContentKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, post: Post) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handlePostNavigate(post);
      }
    },
    [handlePostNavigate]
  );

  const openGallery = useCallback((postId: number, index: number) => {
    setGallery({ postId, index });
  }, []);

  const handleCommentsNavigate = useCallback(
    (post: Post) => {
      const postRef = post.slug ?? post.id;
      const url = new URL(`/app/feed/${postRef}`, window.location.origin);
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
    async (postId: number, emoji: string) => {
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

      // If clicking the same emoji, remove it
      if (existing && existing.reaction_type === emoji) {
        updatePendingReaction(postId, true);
        try {
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
        return;
      }

      // Otherwise, add or update the reaction
      updatePendingReaction(postId, true);
      try {
        if (existing) {
          // Delete existing and create new one
          await apiDelete(`/reactions/${existing.id}/`, {
            token: accessToken,
            cache: "no-store",
          });
        }
        const created = (await apiPost(
          "/reactions/",
          { post: postId, reaction_type: emoji },
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

  // Handle double-tap to like
  const handleDoubleTap = useCallback(
    (postId: number) => {
      if (!accessToken || !user) {
        toast.show("Sign in to react to posts.", "error");
        return;
      }
      
      // Show animation
      setDoubleTapAnimation({ postId, show: true });
      setTimeout(() => {
        setDoubleTapAnimation((prev) => prev?.postId === postId ? { postId, show: false } : prev);
      }, 600);
      
      // Trigger like reaction
      handleToggleReaction(postId, "👍");
    },
    [accessToken, user, toast, handleToggleReaction]
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
      const filterActive = !showFriendPosts || !showPagePosts || selectedCategory;
      const filterLabel = 
        selectedCategory ? `"${selectedCategory}"` :
        !showFriendPosts && showPagePosts ? "Page posts" :
        showFriendPosts && !showPagePosts ? "Friend posts" :
        "posts";
      
      return (
        <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
          <Image
            src="/assets/empty-state.svg"
            alt="Empty feed"
            width={180}
            height={180}
            className="mx-auto mb-4 opacity-90"
          />
          {filterActive ? (
            <>
              <h2 className="text-lg font-semibold text-gray-800">
                You've seen all {filterLabel}.
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Here are other posts you might enjoy:
              </p>
              <button
                onClick={() => {
                  setShowFriendPosts(true);
                  setShowPagePosts(true);
                  setSelectedCategory(undefined);
                  loadFeed(undefined, false, {
                    showFriendPosts: true,
                    showPagePosts: true,
                    selectedCategory: undefined,
                  });
                }}
                className="mt-4 inline-block rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 transition"
              >
                Show All Posts
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-800">Your feed is waiting.</h2>
              <p className="mt-2 text-sm text-gray-500">
                Follow friends or join communities to see posts here.
              </p>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {posts.map((post) => {
          const reactionSummary = summariseReactions(post.reactions ?? []);
          const mediaUrls = Array.isArray(post.media) ? post.media.filter(Boolean) : [];
          
          // Check if this is a page post
          const isPagePost = post.author_type === "page" && post.page;
          
          const authorLabel = isPagePost
            ? post.page!.name
            : post.author.username ||
            [post.author.first_name, post.author.last_name].filter(Boolean).join(" ") ||
            post.author.email;
          
          const avatarUrl = isPagePost
            ? post.page!.profile_image_url
            : post.author.profile_image_url;
          
          const profileHref = isPagePost
            ? `/app/pages/${post.page!.slug ?? post.page!.id}`
            : (post.author?.id && post.author.id !== "undefined" ? `/app/users/${post.author.slug ?? post.author.id}` : null);
          const currentUserReaction =
            user && post.reactions
              ? post.reactions.find((reaction) => reaction.user?.id === user.id)
              : undefined;
          const liked = Boolean(currentUserReaction);
          const reactionBusy = pendingReactions.has(post.id);
          const showReactionPicker = openReactionPickerPostId === post.id;

          return (
            <article
              key={post.id}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDoubleTap(post.id);
              }}
              className={`relative ${mounted ? (
                typeof feedBackgroundTheme === 'string' && feedBackgroundTheme.startsWith('/backgrounds/')
                  ? "rounded-[18px] border border-gray-100/60 bg-white/60 p-5 shadow-sm backdrop-blur-md transition hover:shadow-md sm:p-6"
                  : getPostCardClasses(feedBackgroundTheme as string)
              ) : "rounded-[18px] border border-gray-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition hover:shadow-md sm:p-6"}`}
            >
              {/* Double-tap like animation */}
              {doubleTapAnimation?.postId === post.id && doubleTapAnimation.show && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="double-tap-heart-animation">
                    <span className="text-6xl">👍</span>
                  </div>
                </div>
              )}
              <header className="mb-4 flex items-start justify-between gap-3">
                {profileHref ? (
                  <Link href={profileHref} className="flex items-center gap-3 transition hover:opacity-90">
                    <AuthorMeta
                      authorLabel={authorLabel}
                      createdAt={post.created_at}
                      avatarUrl={avatarUrl}
                      onAvatarClick={
                        avatarUrl
                          ? () =>
                              setProfileImageGallery({
                                image: avatarUrl,
                                title: authorLabel || undefined,
                              })
                          : undefined
                      }
                    />
                  </Link>
                ) : (
                  <AuthorMeta
                    authorLabel={authorLabel}
                    createdAt={post.created_at}
                    avatarUrl={avatarUrl}
                    onAvatarClick={
                      avatarUrl
                        ? () =>
                            setProfileImageGallery({
                              image: avatarUrl,
                              title: authorLabel || undefined,
                            })
                        : undefined
                    }
                  />
                )}
                <PostActionsMenu
                  post={post}
                  accessToken={accessToken}
                  currentUserId={user?.id ?? null}
                  onUpdated={handlePostUpdated}
                  onDeleted={handlePostDeleted}
                />
              </header>

              <div
                role="link"
                tabIndex={0}
                aria-label="Open post"
                className="cursor-pointer"
                onClick={(event) => handlePostContentClick(event, post)}
                onKeyDown={(event) => handlePostContentKeyDown(event, post)}
              >
                <LinkifiedPostContent
                  content={post.content}
                  className="whitespace-pre-line text-sm text-gray-800 sm:text-base break-words"
                />
              </div>

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

              {reactionSummary.total > 0 && (
                <div className="mt-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReactionsModalData(post.reactions || []);
                      setReactionsModalOpen(true);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Show reactions ({reactionSummary.total})
                  </button>
                </div>
              )}

              <footer className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenReactionPickerPostId(showReactionPicker ? null : post.id);
                    }}
                    aria-pressed={liked}
                    disabled={reactionBusy}
                    aria-label={liked ? "Remove your reaction" : "React to this post"}
                    aria-expanded={showReactionPicker}
                    className={[
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition disabled:cursor-not-allowed",
                      liked
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                        : "border-gray-200 text-gray-600 hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]",
                      reactionBusy ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    {currentUserReaction ? (
                      <span className="text-base">{getReactionEmoji(currentUserReaction.reaction_type)}</span>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  {showReactionPicker && (
                    <ReactionPicker
                      onSelect={(reactionType) => handleToggleReaction(post.id, reactionType)}
                      onClose={() => setOpenReactionPickerPostId(null)}
                      currentReaction={currentUserReaction?.reaction_type ?? null}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleCommentsNavigate(post)}
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
                <button
                  type="button"
                  onClick={() => {
                    setShareModalPost(post);
                    setShareModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-600 transition hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                  aria-label="Share post"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M12 2v10M7 7l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Share
                </button>
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

  // Check if background is a video
  const isVideoBackground = mounted && 
    typeof feedBackgroundTheme === 'string' && 
    feedBackgroundTheme.startsWith('/backgrounds/') &&
    /\.(mp4|webm|ogg|mov)$/i.test(feedBackgroundTheme);
  
  const isImageBackground = mounted && 
    typeof feedBackgroundTheme === 'string' && 
    feedBackgroundTheme.startsWith('/backgrounds/') &&
    !isVideoBackground;

  return (
    <>
      <div 
        className={`space-y-6 min-h-screen pb-8 ${
          isImageBackground || isVideoBackground
            ? 'feed-background-container'
            : mounted
            ? BACKGROUND_CLASSES[feedBackgroundTheme as string] || ''
            : ''
        }`}
        style={{ 
          position: 'relative',
          padding: '1rem',
          ...(mounted ? (
            isImageBackground
              ? {
                  backgroundImage: `url(${feedBackgroundTheme})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundAttachment: 'fixed',
                }
              : feedBackgroundTheme === 'default'
              ? { background: 'var(--bg-gradient)' }
              : {}
          ) : {})
        }}
      >
        {/* Video Background */}
        {isVideoBackground && (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="fixed inset-0 w-full h-full object-cover feed-bg-video -z-10"
            style={{ pointerEvents: 'none' }}
          >
            <source src={feedBackgroundTheme as string} type={`video/${(feedBackgroundTheme as string).split('.').pop()}`} />
          </video>
        )}
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between relative z-10">
          <div>
            <h1 className={`text-2xl font-bold ${
              (typeof feedBackgroundTheme === 'string' && feedBackgroundTheme.startsWith('/backgrounds/')) || feedBackgroundTheme === 'christmas'
                ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' 
                : 'text-(--color-gold)'
            }`}>Your Feed</h1>
          </div>
        </header>

        {/* Background and Filter Buttons */}
        <div className="flex items-center gap-2 relative z-10">
          <button
            type="button"
            onClick={() => setBackgroundModalOpen(true)}
            className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${
              (typeof feedBackgroundTheme === 'string' && feedBackgroundTheme.startsWith('/backgrounds/')) || feedBackgroundTheme === 'christmas'
                ? 'border-white/80 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
                : 'border-(--color-gold) bg-(--color-deep-navy) text-(--color-gold) hover:bg-(--color-gold) hover:text-(--color-deeper-navy)'
            }`}
            title="Change feed background"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M2 12h20" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Background</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltersVisible(!filtersVisible)}
            className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${
              filtersVisible
                ? (typeof feedBackgroundTheme === 'string' && feedBackgroundTheme.startsWith('/backgrounds/')) || feedBackgroundTheme === 'christmas'
                  ? 'border-white/80 bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
                  : 'border-(--color-gold) bg-(--color-gold) text-(--color-deeper-navy) hover:opacity-90'
                : (typeof feedBackgroundTheme === 'string' && feedBackgroundTheme.startsWith('/backgrounds/')) || feedBackgroundTheme === 'christmas'
                ? 'border-white/80 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
                : 'border-(--color-gold) bg-(--color-deep-navy) text-(--color-gold) hover:bg-(--color-gold) hover:text-(--color-deeper-navy)'
            }`}
            title={filtersVisible ? "Hide filters" : "Show filters"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Filters</span>
          </button>
        </div>

        {/* Feed Filter Tabs - Hidden by default */}
        {filtersVisible && (
          <FeedFilterTabs onFiltersChange={(filters) => {
            setShowFriendPosts(filters.showFriendPosts);
            setShowPagePosts(filters.showPagePosts);
            setSelectedCategory(filters.selectedCategory);
            // Reload feed with new filters
            loadFeed(undefined, false, filters);
          }} />
        )}

        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="flex-1">{renderPosts()}</div>

          <aside className="hidden xl:block xl:w-[280px] xl:shrink-0">
            <div className="space-y-6 xl:sticky xl:top-36">
              <div className="rounded-2xl bg-white/85 p-4 shadow-sm backdrop-blur-sm">
                <h2 className="text-sm font-semibold text-gray-800">Pages you can follow</h2>
                {loadingPages ? (
                  <div className="mt-4 flex justify-center">
                    <Spinner />
                  </div>
                ) : suggestedPages.length === 0 ? (
                  <p className="mt-4 text-xs text-gray-500">No pages available yet.</p>
                ) : (
                  <ul className="mt-4 space-y-3 text-sm text-gray-600">
                    {suggestedPages.map((page) => (
                      <li
                        key={page.id}
                        className="rounded-lg border border-gray-100 bg-white/70 p-3 shadow-sm"
                      >
                        <Link
                          href={`/app/pages/${page.slug ?? page.id}`}
                          className="flex items-center gap-2 hover:opacity-80 transition"
                        >
                          {page.profile_image_url && (
                            <Image
                              src={page.profile_image_url}
                              alt={page.name}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded-full object-cover shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-[var(--color-primary)] truncate">
                              {page.name}
                            </h3>
                            <p className="text-xs text-gray-500 truncate">{page.category}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl bg-white/85 p-4 shadow-sm backdrop-blur-sm">
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

      {gallery && (() => {
        const activePost = posts.find((post) => post.id === gallery.postId);
        if (!activePost) return null;
        const media = Array.isArray(activePost.media) ? activePost.media.filter(Boolean) : [];
        if (media.length === 0) return null;
        const authorLabel =
          activePost.author.username ||
          [activePost.author.first_name, activePost.author.last_name].filter(Boolean).join(" ") ||
          activePost.author.email ||
          "Post image";
        return (
          <ImageGallery
            open={true}
            onClose={closeGallery}
            images={media}
            currentIndex={gallery.index}
            onNavigate={handleGalleryNavigate}
            onSelect={(index) => setGallery((prev) => (prev ? { ...prev, index } : prev))}
            title={authorLabel}
            timestamp={activePost.created_at}
            caption={activePost.content || undefined}
          />
        );
      })()}
      {profileImageGallery && (
        <ImageGallery
          open={true}
          onClose={() => setProfileImageGallery(null)}
          images={[profileImageGallery.image]}
          currentIndex={0}
          title={profileImageGallery.title}
        />
      )}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setShareModalPost(null);
        }}
        shareUrl={shareModalPost ? `${typeof window !== 'undefined' ? window.location.origin : ''}/app/feed/${shareModalPost.slug ?? shareModalPost.id}` : ''}
        title="Share Post"
        type="post"
      />
      <ReactionsModal
        reactions={reactionsModalData}
        isOpen={reactionsModalOpen}
        onClose={() => setReactionsModalOpen(false)}
        postOrCommentTitle="Post"
      />
      <FeedBackgroundModal
        open={backgroundModalOpen}
        onClose={() => setBackgroundModalOpen(false)}
        currentTheme={feedBackgroundTheme}
        onThemeChange={changeTheme}
      />
    </>
  );
}

function AuthorMeta({
  authorLabel,
  createdAt,
  avatarUrl,
  onAvatarClick,
}: {
  authorLabel: string | null | undefined;
  createdAt: string;
  avatarUrl?: string | null;
  onAvatarClick?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onAvatarClick}
        disabled={!avatarUrl || !onAvatarClick}
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gray-100 transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 disabled:cursor-default disabled:hover:opacity-100"
      >
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
      </button>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{authorLabel}</p>
        <p className="text-xs text-gray-500">{new Date(createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}
