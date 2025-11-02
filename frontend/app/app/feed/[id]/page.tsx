"use client";

import { useAuth } from "@/lib/auth-context";
import { API_BASE, apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Comment, Post, Reaction } from "@/lib/types";
import RequireAuth from "@/components/auth/RequireAuth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ReactionBreakdown = {
  total: number;
  byType: Record<Reaction["reaction_type"], number>;
};

function summariseReactions(reactions: Reaction[]): ReactionBreakdown {
  return reactions.reduce<ReactionBreakdown>(
    (acc, reaction) => {
      acc.total += 1;
      acc.byType[reaction.reaction_type] += 1;
      return acc;
    },
    {
      total: 0,
      byType: { like: 0, love: 0, haha: 0, sad: 0, angry: 0 },
    }
  );
}

const EMOJI_OPTIONS = [
  "😀",
  "😂",
  "😍",
  "😢",
  "😡",
  "👍",
  "🔥",
  "🎉",
  "🙏",
  "❤️",
];

type GalleryState =
  | { type: "post"; index: number }
  | { type: "comment"; commentId: number; index: number };

type MediaAttachment = { file: File; preview: string };

const MAX_COMMENT_MEDIA = 4;

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const toast = useToast();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryState | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [commentAttachments, setCommentAttachments] = useState<MediaAttachment[]>([]);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [emojiPaletteOpen, setEmojiPaletteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsSnapshotRef = useRef<MediaAttachment[]>([]);
  const [reactionPending, setReactionPending] = useState(false);

  useEffect(() => {
    attachmentsSnapshotRef.current = commentAttachments;
  }, [commentAttachments]);

  useEffect(() => {
    return () => {
      attachmentsSnapshotRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  useEffect(() => {
    if (!params?.id || !accessToken) return;
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGet<Post>(`/posts/${params.id}/`, {
          token: accessToken,
          cache: "no-store",
          signal: controller.signal,
        });
        setPost(data);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
        if (err?.status === 404) {
          setPost(null);
          setError("Post not found.");
          return;
        }
        console.error(err);
        setError(err?.message || "Unable to load this post right now.");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [params?.id, accessToken]);

  const reactionSummary = useMemo(
    () => summariseReactions(post?.reactions ?? []),
    [post?.reactions]
  );

  const currentReaction = useMemo(() => {
    if (!post || !user) return null;
    return (post.reactions ?? []).find((reaction) => reaction.user?.id === user.id) ?? null;
  }, [post?.reactions, user?.id]);

  const liked = Boolean(currentReaction);

  const postMedia = useMemo(() => {
    if (!post) return [] as string[];
    return Array.isArray(post.media) ? post.media.filter(Boolean) : [];
  }, [post]);

  const postMediaGridClass = useMemo(() => {
    if (postMedia.length === 1) return "grid-cols-1";
    if (postMedia.length === 2) return "grid-cols-2";
    return "grid-cols-3";
  }, [postMedia.length]);

  const activeGalleryMedia = useMemo(() => {
    if (!gallery || !post) return [] as string[];
    if (gallery.type === "post") {
      return Array.isArray(post.media) ? post.media.filter(Boolean) : [];
    }
    const target = (post.comments ?? []).find((item) => item.id === gallery.commentId);
    return target && Array.isArray(target.media) ? target.media.filter(Boolean) : [];
  }, [gallery, post]);

  const galleryMeta = useMemo(() => {
    if (!gallery || !post) return null as null | { title: string; timestamp: string };
    if (gallery.type === "post") {
      const label =
        post.author.username ||
        [post.author.first_name, post.author.last_name].filter(Boolean).join(" ") ||
        post.author.email ||
        "Post";
      return { title: label, timestamp: post.created_at };
    }
    const comment = (post.comments ?? []).find((item) => item.id === gallery.commentId);
    if (!comment) return null;
    const label =
      comment.author.username ||
      [comment.author.first_name, comment.author.last_name].filter(Boolean).join(" ") ||
      comment.author.email ||
      "Comment";
    return { title: label, timestamp: comment.created_at };
  }, [gallery, post]);

  const handleOpenGallery = useCallback((state: GalleryState) => {
    setEmojiPaletteOpen(false);
    setGallery(state);
  }, []);

  const handleCloseGallery = useCallback(() => {
    setGallery(null);
  }, []);

  const handleGalleryNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (!gallery || activeGalleryMedia.length === 0) return;
      const delta = direction === "prev" ? -1 : 1;
      setGallery((current) => {
        if (!current) return current;
        const length = activeGalleryMedia.length;
        const nextIndex = (current.index + delta + length) % length;
        return { ...current, index: nextIndex };
      });
    },
    [gallery, activeGalleryMedia]
  );

  const handleGallerySelect = useCallback((index: number) => {
    setGallery((current) => {
      if (!current) return current;
      return { ...current, index };
    });
  }, []);

  const handleToggleReaction = useCallback(async () => {
    if (!post || !accessToken || !user) {
      toast.show("Sign in to react to this post.", "error");
      return;
    }
    if (reactionPending) return;
    setReactionPending(true);
    try {
      if (currentReaction) {
        await apiDelete(`/reactions/${currentReaction.id}/`, {
          token: accessToken,
          cache: "no-store",
        });
        setPost((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            reactions: (prev.reactions ?? []).filter(
              (reaction) => reaction.id !== currentReaction.id
            ),
          };
        });
      } else {
        const created = (await apiPost(
          "/reactions/",
          { post: post.id, reaction_type: "like" },
          { token: accessToken, cache: "no-store" }
        )) as Reaction;
        const normalized: Reaction = {
          ...created,
          user: created.user ?? user,
        };
        setPost((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            reactions: [
              ...(prev.reactions ?? []).filter((reaction) => reaction.user?.id !== user.id),
              normalized,
            ],
          };
        });
      }
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "We couldn't update your reaction. Please try again.";
      toast.show(message, "error");
    } finally {
      setReactionPending(false);
    }
  }, [post, accessToken, user, reactionPending, currentReaction, toast]);

  useEffect(() => {
    if (!gallery) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseGallery();
      } else if (event.key === "ArrowLeft") {
        handleGalleryNavigate("prev");
      } else if (event.key === "ArrowRight") {
        handleGalleryNavigate("next");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [gallery, handleCloseGallery, handleGalleryNavigate]);

  useEffect(() => {
    if (!gallery) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [gallery]);

  useEffect(() => {
    if (!gallery) return;
    if (activeGalleryMedia.length === 0) {
      setGallery(null);
    } else if (gallery.index > activeGalleryMedia.length - 1) {
      setGallery({ ...gallery, index: activeGalleryMedia.length - 1 });
    }
  }, [gallery, activeGalleryMedia]);

  const handleSelectAttachment = useCallback(() => {
    setCommentError(null);
    setEmojiPaletteOpen(false);
    fileInputRef.current?.click();
  }, []);

  const handleFilesAdded = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;
      const remaining = MAX_COMMENT_MEDIA - commentAttachments.length;
      if (remaining <= 0) {
        setCommentError(`You can attach up to ${MAX_COMMENT_MEDIA} images or GIFs.`);
        event.target.value = "";
        return;
      }
      const accepted = files.slice(0, remaining);
      const attachments = accepted.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setCommentAttachments((prev) => [...prev, ...attachments]);
      if (files.length > remaining) {
        setCommentError(`Only the first ${remaining} file${remaining === 1 ? "" : "s"} were attached.`);
      } else {
        setCommentError(null);
      }
      event.target.value = "";
    },
    [commentAttachments.length]
  );

  const handleRemoveAttachment = useCallback((preview: string) => {
    setCommentAttachments((prev) => {
      const target = prev.find((item) => item.preview === preview);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((item) => item.preview !== preview);
    });
  }, []);

  const handleEmojiInsert = useCallback((emoji: string) => {
    setCommentError(null);
    setCommentContent((prev) => `${prev}${emoji}`);
    setEmojiPaletteOpen(false);
  }, []);

  const handleCommentSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!post || !accessToken || commentSubmitting) return;
      const trimmed = commentContent.trim();
      if (!trimmed && commentAttachments.length === 0) {
        setCommentError("Share a thought or add an attachment to comment.");
        return;
      }
      setCommentSubmitting(true);
      setCommentError(null);
      let mediaUrls: string[] = [];
      if (commentAttachments.length > 0) {
        const formData = new FormData();
        commentAttachments.forEach(({ file }) => formData.append("files", file));
        let uploadResponse: Response;
        try {
          uploadResponse = await fetch(`${API_BASE}/uploads/images/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          });
        } catch (uploadError) {
          setCommentError("We couldn't upload your attachments. Please try again.");
          setCommentSubmitting(false);
          return;
        }
        const uploadData = await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok || !uploadData) {
          const message =
            (uploadData && (uploadData.detail || uploadData.message)) ||
            "Upload failed. Please try again.";
          setCommentError(message);
          setCommentSubmitting(false);
          return;
        }
        mediaUrls = Array.isArray(uploadData.urls)
          ? uploadData.urls
          : uploadData.url
          ? [uploadData.url]
          : [];
        if (mediaUrls.length === 0) {
          setCommentError("Upload succeeded without media URLs. Please retry.");
          setCommentSubmitting(false);
          return;
        }
      }

      const payload = {
        post: post.id,
        content: trimmed || "(media attachment)",
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      };

      try {
        const created = (await apiPost("/comments/", payload, {
          token: accessToken,
          cache: "no-store",
        })) as Comment;
        setPost((prev) => {
          if (!prev) return prev;
          const nextComments = [...(prev.comments ?? []), created];
          return { ...prev, comments: nextComments };
        });
        setCommentContent("");
        setCommentAttachments((prev) => {
          prev.forEach((item) => URL.revokeObjectURL(item.preview));
          return [];
        });
        setEmojiPaletteOpen(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (err: any) {
        console.error(err);
        const message =
          err?.message ||
          "We couldn't post your comment right now. Please try again.";
        setCommentError(message);
      } finally {
        setCommentSubmitting(false);
      }
    },
    [post, accessToken, commentContent, commentAttachments, commentSubmitting]
  );

  return (
    <RequireAuth>
      <section className="min-h-screen bg-[var(--color-background)] pb-12 pt-20 sm:pt-24">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <Link
            href="/app/feed"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] transition hover:opacity-80"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to feed
          </Link>

          <div className="mt-6 rounded-[18px] border border-gray-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : error ? (
              <div className="text-center text-sm text-gray-600">
                <p>{error}</p>
                <button
                  onClick={() => router.refresh()}
                  className="mt-4 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
                >
                  Retry
                </button>
              </div>
            ) : !post ? (
              <div className="text-center text-sm text-gray-600">
                <p>{error ?? "This post could not be found."}</p>
              </div>
            ) : (
              <>
                <header className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                    {post.author.profile_image_url ? (
                      <Image
                        src={post.author.profile_image_url}
                        alt={post.author.username || post.author.email}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-base font-semibold text-gray-600">
                        {(post.author.username ||
                          post.author.email)?.[0]?.toUpperCase() || "U"}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {post.author.username ||
                        `${post.author.first_name} ${post.author.last_name}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>
                </header>

                <p className="whitespace-pre-line text-sm text-gray-800 sm:text-base">
                  {post.content}
                </p>

                {postMedia.length > 0 && (
                  <div className={`mt-4 grid gap-2 sm:gap-3 ${postMediaGridClass}`}>
                    {postMedia.slice(0, 9).map((url, index) => (
                      <button
                        key={`post-media-${index}`}
                        type="button"
                        onClick={() => handleOpenGallery({ type: "post", index })}
                        className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                      >
                        <Image
                          src={url}
                          alt={`Post media ${index + 1}`}
                          width={768}
                          height={512}
                          loading={index === 0 ? "eager" : "lazy"}
                          sizes={
                            postMedia.length === 1
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

                <footer className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-4 text-sm text-gray-600">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={handleToggleReaction}
                      aria-pressed={liked}
                      disabled={reactionPending}
                      aria-label={liked ? "Remove your reaction" : "React to this post"}
                      className={[
                        "inline-flex items-center justify-center rounded-full border p-1.5 transition disabled:cursor-not-allowed",
                        liked
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                          : "border-gray-200 text-gray-600 hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]",
                        reactionPending ? "opacity-60" : "",
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
                    </button>
                    <span className="flex items-center gap-1">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
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
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    {Object.entries(reactionSummary.byType)
                      .filter(([, value]) => value > 0)
                      .map(([type, value]) => (
                        <span key={type}>
                          {type}: {value}
                        </span>
                      ))}
                  </div>
                </footer>

                <section id="comments" className="mt-8">
                  <h2 className="text-sm font-semibold text-gray-800">Comments</h2>

                  <form onSubmit={handleCommentSubmit} className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm">
                    <textarea
                      rows={3}
                      value={commentContent}
                      onChange={(event) => {
                        setCommentContent(event.target.value);
                        if (commentError) setCommentError(null);
                      }}
                      placeholder="Share your thoughts..."
                      className="w-full resize-none rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />

                    {emojiPaletteOpen && (
                      <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-white/95 p-2 shadow-sm">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiInsert(emoji)}
                            className="text-xl transition hover:scale-110"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {commentAttachments.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {commentAttachments.map((item) => (
                          <div
                            key={item.preview}
                            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white"
                          >
                            <img
                              src={item.preview}
                              alt="Comment attachment preview"
                              className="h-40 w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(item.preview)}
                              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                              aria-label="Remove attachment"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {commentError && (
                      <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                        {commentError}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEmojiPaletteOpen((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                      >
                        <span role="img" aria-hidden>
                          🙂
                        </span>
                        Emoji
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectAttachment}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                      >
                        <span role="img" aria-hidden>
                          🖼️
                        </span>
                        Photo / GIF
                      </button>
                      <button
                        type="submit"
                        disabled={commentSubmitting}
                        className="ml-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {commentSubmitting ? "Posting..." : "Comment"}
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFilesAdded}
                    />
                  </form>

                  {(post.comments ?? []).length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">
                      No comments yet — be the first to share your thoughts.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-4">
                      {(post.comments ?? []).map((comment: Comment) => {
                        const attachments = Array.isArray(comment.media) ? comment.media.filter(Boolean) : [];
                        const attachmentGridClass = attachments.length === 1 ? "grid-cols-1" : attachments.length === 2 ? "grid-cols-2" : "grid-cols-3";
                        const showContent = comment.content && !(attachments.length > 0 && comment.content === "(media attachment)");
                        return (
                          <li
                            key={comment.id}
                            className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/90 p-4"
                          >
                            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                              {comment.author.profile_image_url ? (
                                <Image
                                  src={comment.author.profile_image_url}
                                  alt={comment.author.username || comment.author.email}
                                  width={36}
                                  height={36}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-xs font-semibold text-gray-600">
                                  {(comment.author.username || comment.author.email)?.[0]?.toUpperCase() || "U"}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-800">
                                {comment.author.username || `${comment.author.first_name} ${comment.author.last_name}`}
                              </p>
                              {showContent && (
                                <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                                  {comment.content}
                                </p>
                              )}
                              {attachments.length > 0 && (
                                <div className={`mt-3 grid gap-2 ${attachmentGridClass}`}>
                                  {attachments.slice(0, 9).map((url, index) => (
                                    <button
                                      key={`${comment.id}-media-${index}`}
                                      type="button"
                                      onClick={() => handleOpenGallery({ type: "comment", commentId: comment.id, index })}
                                      className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                                    >
                                      <Image
                                        src={url}
                                        alt={`Comment attachment ${index + 1}`}
                                        width={480}
                                        height={360}
                                        loading="lazy"
                                        sizes="(min-width: 768px) 220px, 45vw"
                                        className="h-full w-full object-cover"
                                      />
                                      <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                                    </button>
                                  ))}
                                </div>
                              )}
                              <p className="mt-2 text-xs text-gray-500">
                                {new Date(comment.created_at).toLocaleString()}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </section>
      {gallery && activeGalleryMedia.length > 0 && galleryMeta && (
        <GalleryModal
          media={activeGalleryMedia}
          state={gallery}
          meta={galleryMeta}
          onClose={handleCloseGallery}
          onNavigate={handleGalleryNavigate}
          onSelect={handleGallerySelect}
        />
      )}
    </RequireAuth>
  );
}

type GalleryModalProps = {
  media: string[];
  state: GalleryState;
  meta: { title: string; timestamp: string } | null;
  onClose: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onSelect: (index: number) => void;
};

function GalleryModal({ media, state, meta, onClose, onNavigate, onSelect }: GalleryModalProps) {
  if (!meta) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10 sm:px-6"
    >
      <div className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white/95 shadow-2xl backdrop-blur">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">{meta.title}</p>
            <p className="text-xs text-gray-500">{new Date(meta.timestamp).toLocaleString()}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close gallery"
            className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="relative h-full w-full min-h-[260px] sm:min-h-[360px]">
            <Image
              key={media[state.index]}
              src={media[state.index]}
              alt={`Gallery media ${state.index + 1}`}
              fill
              priority
              sizes="(min-width: 1024px) 768px, 90vw"
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
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <footer className="flex flex-col gap-4 px-6 py-4">
          <div className="flex items-center justify-center gap-2">
            {media.map((_, index) => (
              <button
                key={`gallery-dot-${index}`}
                type="button"
                aria-label={`View image ${index + 1}`}
                onClick={() => onSelect(index)}
                className={[
                  "h-2.5 rounded-full transition",
                  index === state.index ? "w-6 bg-[var(--color-primary)]" : "w-2.5 bg-gray-300 hover:bg-gray-400",
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
