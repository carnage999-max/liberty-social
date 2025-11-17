"use client";

import { useAuth } from "@/lib/auth-context";
import { API_BASE, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Comment, Post, Reaction, ReactionSummary } from "@/lib/types";
import RequireAuth from "@/components/auth/RequireAuth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { PostActionsMenu } from "@/components/feed/PostActionsMenu";
import { ReactionPicker } from "@/components/feed/ReactionPicker";
import ShareModal from "@/components/modals/ShareModal";
import { EmojiPickerPopper } from "@/components/EmojiPickerPopper";
import ImageGallery from "@/components/ImageGallery";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  // If it's in the mapping, return the emoji
  if (REACTION_TYPE_TO_EMOJI[reactionType]) {
    return REACTION_TYPE_TO_EMOJI[reactionType];
  }
  // Otherwise it's already an emoji, return it
  return reactionType;
}

type ReactionBreakdown = {
  total: number;
  byType: Record<string, number>;
};

function summariseReactions(reactions: Reaction[]): ReactionBreakdown {
  return reactions.reduce<ReactionBreakdown>(
    (acc, reaction) => {
      acc.total += 1;
      // Convert old text types to emojis, keep new emoji types as-is
      const type = getReactionEmoji(reaction.reaction_type);
      acc.byType[type] = (acc.byType[type] || 0) + 1;
      return acc;
    },
    {
      total: 0,
      byType: {},
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

const REACTION_TYPES: Reaction["reaction_type"][] = ["like", "love", "haha", "sad", "angry"];

const createEmptyReactionSummary = (): ReactionSummary => ({
  total: 0,
  by_type: REACTION_TYPES.reduce<Record<Reaction["reaction_type"], number>>((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {} as Record<Reaction["reaction_type"], number>),
});

const normaliseReactionSummary = (
  summary?: ReactionSummary | null,
  reactions?: Reaction[]
): ReactionSummary => {
  const base = createEmptyReactionSummary();
  if (summary) {
    base.total = summary.total ?? 0;
    for (const type of REACTION_TYPES) {
      base.by_type[type] = summary.by_type?.[type] ?? 0;
    }
    return base;
  }
  if (reactions && reactions.length > 0) {
    const computed = summariseReactions(reactions);
    base.total = computed.total;
    for (const type of REACTION_TYPES) {
      base.by_type[type] = computed.byType[type] ?? 0;
    }
  }
  return base;
};

const ensureCommentSummary = (comment: Comment): Comment => ({
  ...comment,
  reactions: comment.reactions ?? [],
  reaction_summary: normaliseReactionSummary(comment.reaction_summary, comment.reactions),
  replies_count: comment.replies_count ?? 0,
});

const ensurePost = (post: Post): Post => ({
  ...post,
  comments: (post.comments ?? []).map(ensureCommentSummary),
});

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
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [commentEditContent, setCommentEditContent] = useState("");
  const [commentActionPendingId, setCommentActionPendingId] = useState<number | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<number | null>(null);
  const [commentReactionPendingId, setCommentReactionPendingId] = useState<number | null>(null);
  const [commentSort, setCommentSort] = useState<"recent" | "popular" | "oldest">("recent");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const commentEmojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const replyEmojiButtonsRef = useRef<Record<number, HTMLButtonElement | null>>({});
  const attachmentsSnapshotRef = useRef<MediaAttachment[]>([]);
  const [reactionPending, setReactionPending] = useState(false);
  const [openReactionPicker, setOpenReactionPicker] = useState(false);
  const [showReactionBreakdown, setShowReactionBreakdown] = useState(false);
  const [openCommentReactionPickerId, setOpenCommentReactionPickerId] = useState<number | null>(null);
  const [commentEmojiPickerOpen, setCommentEmojiPickerOpen] = useState(false);
  const [replyEmojiPickerOpen, setReplyEmojiPickerOpen] = useState<Record<number, boolean>>({});
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState<Record<number, string>>({});
  const [replyAttachments, setReplyAttachments] = useState<Record<number, MediaAttachment[]>>({});
  const [replySubmitting, setReplySubmitting] = useState<Record<number, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null);
  const [profileImageGallery, setProfileImageGallery] = useState<{
    image: string;
    title?: string;
  } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const handlePostMenuUpdated = useCallback(
    (updated: Post) => {
      setPost((prev) => {
        const merged = ensurePost({ ...(prev ?? {}), ...updated });
        return merged;
      });
    },
    []
  );

  const handlePostMenuDeleted = useCallback(
    (postId: number) => {
      setPost(null);
      toast.show("Post deleted.", "success");
      router.push("/app/feed");
    },
    [router, toast]
  );

  // Count all comments including replies
  const totalComments = useMemo(() => {
    if (!post?.comments) return 0;
    const countAll = (comments: Comment[]): number => {
      return comments.reduce((total, comment) => {
        return total + 1 + (comment.replies ? countAll(comment.replies) : 0);
      }, 0);
    };
    return countAll(post.comments);
  }, [post?.comments]);

  // Filter to only top-level comments (no parent)
  const topLevelComments = useMemo(() => {
    const comments = post?.comments ?? [];
    return comments.filter((comment) => !comment.parent);
  }, [post?.comments]);

  const sortedComments = useMemo(() => {
    const list = [...topLevelComments];
    if (commentSort === "recent") {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return list;
    }
    if (commentSort === "oldest") {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return list;
    }
    // popular
    list.sort((a, b) => {
      const summaryA = normaliseReactionSummary(a.reaction_summary, a.reactions);
      const summaryB = normaliseReactionSummary(b.reaction_summary, b.reactions);
      const scoreA = summaryA.total + (a.replies_count ?? 0);
      const scoreB = summaryB.total + (b.replies_count ?? 0);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [topLevelComments, commentSort]);

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
        setPost(ensurePost(data));
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

  const handleToggleReaction = useCallback(
    async (reactionType: string) => {
      if (!post || !accessToken || !user) {
        toast.show("Sign in to react to this post.", "error");
        return;
      }
      if (reactionPending) return;
      setReactionPending(true);
      try {
        // If clicking the same reaction type, remove it
        if (currentReaction && currentReaction.reaction_type === reactionType) {
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
          // Otherwise, add or update the reaction
          if (currentReaction) {
            // Delete existing and create new one
            await apiDelete(`/reactions/${currentReaction.id}/`, {
              token: accessToken,
              cache: "no-store",
            });
          }
          const created = (await apiPost(
            "/reactions/",
            { post: post.id, reaction_type: reactionType },
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
    },
    [post, accessToken, user, reactionPending, currentReaction, toast]
  );

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
          const nextComments = [...(prev.comments ?? []), ensureCommentSummary(created)];
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

  const handleStartEditComment = useCallback((commentId: number, content: string) => {
    setEditingCommentId(commentId);
    setCommentEditContent(content);
    setOpenCommentMenuId(null);
  }, []);

  const handleCancelEditComment = useCallback(() => {
    setEditingCommentId(null);
    setCommentEditContent("");
    setCommentActionPendingId(null);
  }, []);

  const handleSaveCommentEdit = useCallback(
    async (commentId: number) => {
      if (!accessToken) return;
      const trimmed = commentEditContent.trim();
      if (!trimmed) {
        toast.show("Comment cannot be empty.", "error");
        return;
      }
      setCommentActionPendingId(commentId);
      try {
        await apiPatch(`/comments/${commentId}/`, { content: trimmed }, {
          token: accessToken,
          cache: "no-store",
        });
        setPost((prev) => {
          if (!prev) return prev;
          // Recursively update comment in comments or their replies
          const updateComment = (comments: Comment[]): Comment[] => {
            return comments.map((item) => {
              if (item.id === commentId) {
                return ensureCommentSummary({ ...item, content: trimmed });
              }
              if (item.replies && item.replies.length > 0) {
                return {
                  ...item,
                  replies: updateComment(item.replies),
                };
              }
              return item;
            });
          };
          return { ...prev, comments: updateComment(prev.comments ?? []) };
        });
        toast.show("Comment updated.");
        setEditingCommentId(null);
        setCommentEditContent("");
        setOpenCommentMenuId(null);
      } catch (err) {
        console.error(err);
        toast.show("Unable to update comment.", "error");
      } finally {
        setCommentActionPendingId(null);
      }
    },
    [accessToken, commentEditContent, toast]
  );

  const handleDeleteCommentClick = useCallback((commentId: number) => {
    setDeleteCommentId(commentId);
    setOpenCommentMenuId(null);
  }, []);

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      if (!accessToken) return;
      setDeleteCommentId(null);
      setCommentActionPendingId(commentId);
      try {
        await apiDelete(`/comments/${commentId}/`, {
          token: accessToken,
          cache: "no-store",
        });
        setPost((prev) => {
          if (!prev) return prev;
          // Recursively remove comment from comments or their replies
          const removeComment = (comments: Comment[]): Comment[] => {
            const filtered = comments.filter((item) => item.id !== commentId);
            return filtered.map((comment) => {
              if (comment.replies && comment.replies.length > 0) {
                const filteredReplies = comment.replies.filter((reply) => reply.id !== commentId);
                if (filteredReplies.length !== comment.replies.length) {
                  // A reply was deleted
                  return {
                    ...comment,
                    replies: filteredReplies,
                    replies_count: Math.max(0, (comment.replies_count || 0) - 1),
                  };
                }
                return comment;
              }
              return comment;
            });
          };
          return { ...prev, comments: removeComment(prev.comments ?? []) };
        });
        if (editingCommentId === commentId) {
          setEditingCommentId(null);
          setCommentEditContent("");
        }
        toast.show("Comment deleted.");
      } catch (err) {
        console.error(err);
        toast.show("Unable to delete comment.", "error");
      } finally {
        setCommentActionPendingId(null);
        setOpenCommentMenuId(null);
      }
    },
    [accessToken, editingCommentId, toast]
  );

  const handleToggleCommentReaction = useCallback(
    async (comment: Comment, reactionType: string) => {
      if (!accessToken) {
        toast.show("Sign in to react to comments.", "error");
        return;
      }
      const commentId = comment.id;
      const existingReaction = comment.user_reaction;
      setCommentReactionPendingId(commentId);
      try {
        // If clicking the same reaction type, remove it
        if (existingReaction && existingReaction.reaction_type === reactionType) {
          await apiDelete(`/reactions/${existingReaction.id}/`, {
            token: accessToken,
            cache: "no-store",
          });
          setPost((prev) => {
            if (!prev) return prev;
            // Recursively update comment reaction in comments or their replies
            const updateCommentReaction = (comments: Comment[]): Comment[] => {
              return comments.map((item) => {
                if (item.id === commentId) {
                  const currentSummary = normaliseReactionSummary(item.reaction_summary, item.reactions);
                  const updatedSummary: ReactionSummary = {
                    total: Math.max(0, currentSummary.total - 1),
                    by_type: {
                      ...currentSummary.by_type,
                      [existingReaction.reaction_type]: Math.max(
                        0,
                        (currentSummary.by_type[existingReaction.reaction_type] ?? 0) - 1
                      ),
                    },
                  };
                  const updatedReactions = (item.reactions ?? []).filter((reaction) => reaction.id !== existingReaction.id);
                  return ensureCommentSummary({
                    ...item,
                    reactions: updatedReactions,
                    reaction_summary: updatedSummary,
                    user_reaction: null,
                  });
                }
                if (item.replies && item.replies.length > 0) {
                  return {
                    ...item,
                    replies: updateCommentReaction(item.replies),
                  };
                }
                return item;
              });
            };
            return { ...prev, comments: updateCommentReaction(prev.comments ?? []) };
          });
        } else {
          // Otherwise, add or update the reaction
          if (existingReaction) {
            // Delete existing and create new one
            await apiDelete(`/reactions/${existingReaction.id}/`, {
              token: accessToken,
              cache: "no-store",
            });
          }
          const created = (await apiPost(
            "/reactions/",
            { comment: commentId, reaction_type: reactionType },
            { token: accessToken, cache: "no-store" }
          )) as Reaction;
          setPost((prev) => {
            if (!prev) return prev;
            // Recursively update comment reaction in comments or their replies
            const updateCommentReaction = (comments: Comment[]): Comment[] => {
              return comments.map((item) => {
                if (item.id === commentId) {
                  const currentSummary = normaliseReactionSummary(item.reaction_summary, item.reactions);
                  // Calculate updated summary
                  const updatedByType = { ...currentSummary.by_type };
                  if (existingReaction) {
                    // Decrease count for old reaction type
                    updatedByType[existingReaction.reaction_type] = Math.max(
                      0,
                      (updatedByType[existingReaction.reaction_type] ?? 0) - 1
                    );
                    // Increase count for new reaction type (if different)
                    if (existingReaction.reaction_type !== created.reaction_type) {
                      updatedByType[created.reaction_type] = (updatedByType[created.reaction_type] ?? 0) + 1;
                    }
                  } else {
                    // New reaction - just increase count
                    updatedByType[created.reaction_type] = (updatedByType[created.reaction_type] ?? 0) + 1;
                  }
                  
                  const updatedSummary: ReactionSummary = {
                    total: existingReaction
                      ? currentSummary.total // Total stays the same when changing reaction type
                      : currentSummary.total + 1, // Total increases when adding new reaction
                    by_type: updatedByType,
                  };
                  const existingFiltered = (item.reactions ?? []).filter(
                    (reaction) => reaction.user.id !== created.user.id
                  );
                  const updatedReactions = [...existingFiltered, created];
                  return ensureCommentSummary({
                    ...item,
                    reactions: updatedReactions,
                    reaction_summary: updatedSummary,
                    user_reaction: created,
                  });
                }
                if (item.replies && item.replies.length > 0) {
                  return {
                    ...item,
                    replies: updateCommentReaction(item.replies),
                  };
                }
                return item;
              });
            };
            return { ...prev, comments: updateCommentReaction(prev.comments ?? []) };
          });
        }
      } catch (err) {
        console.error(err);
        toast.show("Unable to update reaction right now.", "error");
      } finally {
        setCommentReactionPendingId(null);
      }
    },
    [accessToken, toast]
  );

  const handleStartReply = useCallback((commentId: number) => {
    setReplyingToId(commentId);
    setReplyContent((prev) => ({ ...prev, [commentId]: "" }));
    setReplyAttachments((prev) => ({ ...prev, [commentId]: [] }));
    setExpandedReplies((prev) => new Set(prev).add(commentId));
  }, []);

  const handleCancelReply = useCallback((commentId: number) => {
    setReplyingToId((prev) => (prev === commentId ? null : prev));
    setReplyContent((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
    setReplyAttachments((prev) => {
      const next = { ...prev };
      const attachments = next[commentId] || [];
      attachments.forEach((item) => URL.revokeObjectURL(item.preview));
      delete next[commentId];
      return next;
    });
  }, []);

  const handleReplySubmit = useCallback(
    async (parentCommentId: number, event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!post || !accessToken || replySubmitting[parentCommentId]) return;
      const content = replyContent[parentCommentId] || "";
      const trimmed = content.trim();
      const attachments = replyAttachments[parentCommentId] || [];
      if (!trimmed && attachments.length === 0) {
        toast.show("Share a thought or add an attachment to reply.", "error");
        return;
      }
      setReplySubmitting((prev) => ({ ...prev, [parentCommentId]: true }));
      let mediaUrls: string[] = [];
      if (attachments.length > 0) {
        const formData = new FormData();
        attachments.forEach(({ file }) => formData.append("files", file));
        let uploadResponse: Response;
        try {
          uploadResponse = await fetch(`${API_BASE}/uploads/images/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          });
        } catch (uploadError) {
          toast.show("We couldn't upload your attachments. Please try again.", "error");
          setReplySubmitting((prev) => ({ ...prev, [parentCommentId]: false }));
          return;
        }
        const uploadData = await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok || !uploadData) {
          const message =
            (uploadData && (uploadData.detail || uploadData.message)) ||
            "Upload failed. Please try again.";
          toast.show(message, "error");
          setReplySubmitting((prev) => ({ ...prev, [parentCommentId]: false }));
          return;
        }
        mediaUrls = Array.isArray(uploadData.urls)
          ? uploadData.urls
          : uploadData.url
          ? [uploadData.url]
          : [];
        if (mediaUrls.length === 0) {
          toast.show("Upload succeeded without media URLs. Please retry.", "error");
          setReplySubmitting((prev) => ({ ...prev, [parentCommentId]: false }));
          return;
        }
      }

      const payload = {
        post: post.id,
        parent: parentCommentId,
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
          const updateCommentWithReply = (comments: Comment[]): Comment[] => {
            return comments.map((comment) => {
              if (comment.id === parentCommentId) {
                return {
                  ...comment,
                  replies: [...(comment.replies || []), ensureCommentSummary(created)],
                  replies_count: (comment.replies_count || 0) + 1,
                };
              }
              if (comment.replies && comment.replies.length > 0) {
                return {
                  ...comment,
                  replies: updateCommentWithReply(comment.replies),
                };
              }
              return comment;
            });
          };
          return {
            ...prev,
            comments: updateCommentWithReply(prev.comments || []),
          };
        });
        handleCancelReply(parentCommentId);
        setExpandedReplies((prev) => new Set(prev).add(parentCommentId));
        toast.show("Reply posted.");
      } catch (err: any) {
        console.error(err);
        const message = err?.message || "We couldn't post your reply right now. Please try again.";
        toast.show(message, "error");
      } finally {
        setReplySubmitting((prev) => ({ ...prev, [parentCommentId]: false }));
      }
    },
    [post, accessToken, replyContent, replyAttachments, replySubmitting, toast, handleCancelReply]
  );

  const handleToggleReplies = useCallback((commentId: number) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }, []);

  const handleReplyFilesAdded = useCallback(
    (commentId: number, event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;
      const currentAttachments = replyAttachments[commentId] || [];
      const remaining = MAX_COMMENT_MEDIA - currentAttachments.length;
      if (remaining <= 0) {
        toast.show(`You can attach up to ${MAX_COMMENT_MEDIA} images or GIFs.`, "error");
        event.target.value = "";
        return;
      }
      const accepted = files.slice(0, remaining);
      const newAttachments = accepted.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setReplyAttachments((prev) => ({
        ...prev,
        [commentId]: [...currentAttachments, ...newAttachments],
      }));
      if (files.length > remaining) {
        toast.show(`Only the first ${remaining} file${remaining === 1 ? "" : "s"} were attached.`);
      }
      event.target.value = "";
    },
    [replyAttachments, toast]
  );

  const handleRemoveReplyAttachment = useCallback((commentId: number, preview: string) => {
    setReplyAttachments((prev) => {
      const current = prev[commentId] || [];
      const target = current.find((item) => item.preview === preview);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return {
        ...prev,
        [commentId]: current.filter((item) => item.preview !== preview),
      };
    });
  }, []);

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
                <header className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (post.author.profile_image_url) {
                          const authorLabel =
                            post.author.username ||
                            [post.author.first_name, post.author.last_name].filter(Boolean).join(" ") ||
                            post.author.email ||
                            "Profile";
                          setProfileImageGallery({
                            image: post.author.profile_image_url,
                            title: authorLabel,
                          });
                        }
                      }}
                      disabled={!post.author.profile_image_url}
                      className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100 transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 disabled:cursor-default disabled:hover:opacity-100"
                    >
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
                    </button>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {post.author.username ||
                          `${post.author.first_name} ${post.author.last_name}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(post.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <PostActionsMenu
                    post={post}
                    accessToken={accessToken}
                    currentUserId={user?.id ?? null}
                    onUpdated={handlePostMenuUpdated}
                    onDeleted={handlePostMenuDeleted}
                  />
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
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenReactionPicker(!openReactionPicker)}
                        aria-pressed={liked}
                        disabled={reactionPending}
                        aria-label={liked ? "Remove your reaction" : "React to this post"}
                        aria-expanded={openReactionPicker}
                        className={[
                          "inline-flex items-center justify-center rounded-full border p-1.5 transition disabled:cursor-not-allowed",
                          liked
                            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                            : "border-gray-200 text-gray-600 hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]",
                          reactionPending ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        {currentReaction ? (
                          <span className="text-base">{getReactionEmoji(currentReaction.reaction_type)}</span>
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
                      {openReactionPicker && (
                        <ReactionPicker
                          onSelect={(reactionType) => handleToggleReaction(reactionType)}
                          onClose={() => setOpenReactionPicker(false)}
                          currentReaction={currentReaction?.reaction_type ?? null}
                        />
                      )}
                    </div>
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
                    <button
                      type="button"
                      onClick={() => setShareModalOpen(true)}
                      className="flex items-center gap-1 text-gray-600 hover:text-[var(--color-primary)] transition"
                      aria-label="Share post"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M12 2v10M7 7l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Share
                    </button>
                  </div>
                  {reactionSummary.total > 0 && (
                    <div className="mt-2">
                      {!showReactionBreakdown ? (
                        <button
                          type="button"
                          onClick={() => setShowReactionBreakdown(true)}
                          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Show reactions
                        </button>
                      ) : (
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 items-center">
                          {Object.entries(reactionSummary.byType)
                            .filter(([, value]) => value > 0)
                            .map(([type, value]) => (
                              <span key={type} className="inline-flex items-center gap-1">
                                <span className="text-base leading-none">{type}</span>
                                <span>{value}</span>
                              </span>
                            ))}
                          <button
                            type="button"
                            onClick={() => setShowReactionBreakdown(false)}
                            className="ml-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            Hide
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
                      <div className="relative">
                        <button
                          ref={commentEmojiButtonRef}
                          type="button"
                          onClick={() => setCommentEmojiPickerOpen(!commentEmojiPickerOpen)}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-[var(--color-primary)]"
                        >
                          <span role="img" aria-hidden>
                            🙂
                          </span>
                          Emoji
                        </button>
                        <EmojiPickerPopper
                          open={commentEmojiPickerOpen}
                          onSelect={(emoji) => {
                            setCommentContent((prev) => prev + emoji);
                            setCommentEmojiPickerOpen(false);
                          }}
                          onClose={() => setCommentEmojiPickerOpen(false)}
                          triggerRef={commentEmojiButtonRef}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSelectAttachment}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-[var(--color-primary)]"
                      >
                        <span role="img" aria-hidden>
                          🖼️
                        </span>
                        Photo / GIF
                      </button>
                      <button
                        type="submit"
                        disabled={commentSubmitting}
                        className="ml-auto inline-flex items-center justify-center btn-primary px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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

                  {totalComments === 0 ? (
                    <p className="mt-6 text-sm text-gray-500">
                      No comments yet — be the first to share your thoughts.
                    </p>
                  ) : (
                    <>
                      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-gray-800">
                          {totalComments} comment{totalComments === 1 ? "" : "s"}
                        </span>
                        <label className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 hidden sm:inline">Sort by</span>
                          <div className="relative">
                            <select
                              value={commentSort}
                              onChange={(event) =>
                                setCommentSort(event.target.value as "recent" | "popular" | "oldest")
                              }
                              className="rounded-full border border-gray-200 bg-white px-4 py-2 pr-8 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-[var(--color-primary)]/40 hover:shadow-md focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                              style={{
                                appearance: "none",
                                WebkitAppearance: "none",
                                MozAppearance: "none",
                              }}
                            >
                              <option value="recent">Most recent</option>
                              <option value="popular">Most popular</option>
                              <option value="oldest">Oldest</option>
                            </select>
                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M6 9l6 6 6-6"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                          </div>
                        </label>
                      </div>
                    <ul className="mt-4 space-y-4">
                      {sortedComments.map((comment: Comment) => {
                        const attachments = Array.isArray(comment.media) ? comment.media.filter(Boolean) : [];
                        const attachmentGridClass = attachments.length === 1 ? "grid-cols-1" : attachments.length === 2 ? "grid-cols-2" : "grid-cols-3";
                        const showContent = comment.content && !(attachments.length > 0 && comment.content === "(media attachment)");
                        const rawCommentAuthorId = comment.author?.id;
                        const hasAuthorId = Boolean(rawCommentAuthorId) && rawCommentAuthorId !== "undefined";
                        const commentProfileHref = hasAuthorId ? `/app/users/${rawCommentAuthorId}` : null;
                        const isCommentOwner = user && hasAuthorId ? String(rawCommentAuthorId) === String(user.id) : false;
                        const commentSummary = normaliseReactionSummary(comment.reaction_summary, comment.reactions);
                        const commentLikeCount = commentSummary.total;
                        const commentLiked = Boolean(comment.user_reaction);
                        const repliesCount = comment.replies_count ?? 0;

                        const renderAuthor = (
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (comment.author.profile_image_url) {
                                  const authorLabel =
                                    comment.author.username ||
                                    [comment.author.first_name, comment.author.last_name].filter(Boolean).join(" ") ||
                                    comment.author.email ||
                                    "Profile";
                                  setProfileImageGallery({
                                    image: comment.author.profile_image_url,
                                    title: authorLabel,
                                  });
                                }
                              }}
                              disabled={!comment.author.profile_image_url}
                              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-100 transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 disabled:cursor-default disabled:hover:opacity-100"
                            >
                              {comment.author.profile_image_url ? (
                                <Image
                                  src={comment.author.profile_image_url}
                                  alt={comment.author.username || comment.author.email || "Profile"}
                                  width={36}
                                  height={36}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-xs font-semibold text-gray-600">
                                  {(comment.author.username || comment.author.email)?.[0]?.toUpperCase() || "U"}
                                </span>
                              )}
                            </button>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800">
                                {comment.author.username || `${comment.author.first_name} ${comment.author.last_name}`}
                              </p>
                              {editingCommentId === comment.id ? (
                                <>
                                  <textarea
                                    value={commentEditContent}
                                    onChange={(event) => setCommentEditContent(event.target.value)}
                                    rows={3}
                                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                                  />
                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={handleCancelEditComment}
                                      className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveCommentEdit(comment.id)}
                                      disabled={commentActionPendingId === comment.id}
                                      className="btn-primary px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {commentActionPendingId === comment.id ? "Saving..." : "Save"}
                                    </button>
                                  </div>
                                </>
                              ) : (
                                showContent && (
                                  <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                                    {comment.content}
                                  </p>
                                )
                              )}
                              {attachments.length > 0 && (
                                <div className={`mt-3 grid gap-2 ${attachmentGridClass}`}>
                                  {attachments.slice(0, 9).map((url, index) => (
                                    <button
                                      key={`${comment.id}-media-${index}`}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleOpenGallery({ type: "comment", commentId: comment.id, index });
                                      }}
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
                              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setOpenCommentReactionPickerId(
                                        openCommentReactionPickerId === comment.id ? null : comment.id
                                      );
                                    }}
                                    aria-pressed={commentLiked}
                                    disabled={commentReactionPendingId === comment.id}
                                    aria-expanded={openCommentReactionPickerId === comment.id}
                                    className={[
                                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 transition",
                                      commentLiked
                                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                        : "border-gray-200 text-gray-600 hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]",
                                      commentReactionPendingId === comment.id ? "cursor-not-allowed opacity-60" : "",
                                    ].join(" ")}
                                  >
                                    {comment.user_reaction ? (
                                      <span className="text-sm">{getReactionEmoji(comment.user_reaction.reaction_type)}</span>
                                    ) : (
                                      <svg
                                        width="14"
                                        height="14"
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
                                    <span className="text-xs font-semibold">{commentLikeCount}</span>
                                  </button>
                                  {openCommentReactionPickerId === comment.id && (
                                    <ReactionPicker
                                      onSelect={(reactionType) => handleToggleCommentReaction(comment, reactionType)}
                                      onClose={() => setOpenCommentReactionPickerId(null)}
                                      currentReaction={comment.user_reaction?.reaction_type ?? null}
                                    />
                                  )}
                                </div>
                                {repliesCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleToggleReplies(comment.id);
                                    }}
                                    className="text-xs text-gray-500 hover:text-[var(--color-primary)] transition"
                                  >
                                    {expandedReplies.has(comment.id)
                                      ? `Hide ${repliesCount} repl${repliesCount === 1 ? "y" : "ies"}`
                                      : `View ${repliesCount} repl${repliesCount === 1 ? "y" : "ies"}`}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleStartReply(comment.id);
                                  }}
                                  className="text-xs font-semibold text-gray-600 hover:text-[var(--color-primary)] transition"
                                >
                                  Reply
                                </button>
                              </div>
                            </div>
                          </div>
                        );

                        const authorNode =
                          commentProfileHref && editingCommentId !== comment.id ? (
                            <Link
                              href={commentProfileHref}
                              className="flex flex-1 items-start gap-3 transition hover:opacity-90"
                            >
                              {renderAuthor}
                            </Link>
                          ) : (
                            <div className="flex flex-1 items-start gap-3">{renderAuthor}</div>
                          );

                        return (
                          <li
                            key={comment.id}
                            className="rounded-xl border border-gray-100 bg-gray-50/90 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              {authorNode}
                              {isCommentOwner && (
                                <div className="relative" data-comment-menu={comment.id}>
                                  <button
                                    type="button"
                                    aria-haspopup="menu"
                                    aria-expanded={openCommentMenuId === comment.id}
                                    onClick={() =>
                                      setOpenCommentMenuId((prev) => (prev === comment.id ? null : comment.id))
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                                  >
                                    <span className="sr-only">Open comment actions</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                      <path
                                        d="M12 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                                        fill="currentColor"
                                      />
                                    </svg>
                                  </button>
                                  {openCommentMenuId === comment.id && (
                                    <div
                                      role="menu"
                                      className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-gray-100 bg-white p-2 text-sm shadow-lg"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditComment(comment.id, comment.content || "")}
                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-gray-700 transition hover:bg-gray-100"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                          <path
                                            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                        Edit comment
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCommentClick(comment.id)}
                                        disabled={commentActionPendingId === comment.id}
                                        className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                          <path
                                            d="M5 7h14M10 11v6M14 11v6M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                        Delete comment
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Replies Section */}
                            {(expandedReplies.has(comment.id) && (comment.replies?.length ?? 0) > 0) && (
                              <div className="mt-4 ml-8 space-y-3 border-l-2 border-gray-200 pl-4">
                                {comment.replies?.map((reply) => {
                                  const replyAttachments = Array.isArray(reply.media) ? reply.media.filter(Boolean) : [];
                                  const replyAttachmentGridClass = replyAttachments.length === 1 ? "grid-cols-1" : replyAttachments.length === 2 ? "grid-cols-2" : "grid-cols-3";
                                  const showReplyContent = reply.content && !(replyAttachments.length > 0 && reply.content === "(media attachment)");
                                  const replyAuthorId = reply.author?.id;
                                  const hasReplyAuthorId = Boolean(replyAuthorId) && replyAuthorId !== "undefined";
                                  const replyProfileHref = hasReplyAuthorId ? `/app/users/${replyAuthorId}` : null;
                                  const isReplyOwner = user && hasReplyAuthorId ? String(replyAuthorId) === String(user.id) : false;
                                  const replySummary = normaliseReactionSummary(reply.reaction_summary, reply.reactions);
                                  const replyLikeCount = replySummary.total;
                                  const replyLiked = Boolean(reply.user_reaction);
                                  
                                  return (
                                    <div
                                      key={reply.id}
                                      className="rounded-lg border border-gray-100 bg-white/80 p-3"
                                    >
                                      <div className="flex items-start gap-2">
                                        {replyProfileHref ? (
                                          <Link
                                            href={replyProfileHref}
                                            className="flex items-start gap-2 transition hover:opacity-90"
                                            onClick={(e) => {
                                              if (reply.author.profile_image_url) {
                                                e.preventDefault();
                                                const authorLabel =
                                                  reply.author.username ||
                                                  [reply.author.first_name, reply.author.last_name].filter(Boolean).join(" ") ||
                                                  reply.author.email ||
                                                  "Profile";
                                                setProfileImageGallery({
                                                  image: reply.author.profile_image_url,
                                                  title: authorLabel,
                                                });
                                              }
                                            }}
                                          >
                                            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                                              {reply.author.profile_image_url ? (
                                                <Image
                                                  src={reply.author.profile_image_url}
                                                  alt={reply.author.username || reply.author.email || "Profile"}
                                                  width={32}
                                                  height={32}
                                                  className="h-full w-full object-cover"
                                                />
                                              ) : (
                                                <span className="text-xs font-semibold text-gray-600">
                                                  {(reply.author.username || reply.author.email)?.[0]?.toUpperCase() || "U"}
                                                </span>
                                              )}
                                            </div>
                                          </Link>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (reply.author.profile_image_url) {
                                                const authorLabel =
                                                  reply.author.username ||
                                                  [reply.author.first_name, reply.author.last_name].filter(Boolean).join(" ") ||
                                                  reply.author.email ||
                                                  "Profile";
                                                setProfileImageGallery({
                                                  image: reply.author.profile_image_url,
                                                  title: authorLabel,
                                                });
                                              }
                                            }}
                                            disabled={!reply.author.profile_image_url}
                                            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-100 transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 disabled:cursor-default disabled:hover:opacity-100"
                                          >
                                            {reply.author.profile_image_url ? (
                                              <Image
                                                src={reply.author.profile_image_url}
                                                alt={reply.author.username || reply.author.email || "Profile"}
                                                width={32}
                                                height={32}
                                                className="h-full w-full object-cover"
                                              />
                                            ) : (
                                              <span className="text-xs font-semibold text-gray-600">
                                                {(reply.author.username || reply.author.email)?.[0]?.toUpperCase() || "U"}
                                              </span>
                                            )}
                                          </button>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <p className="text-xs font-semibold text-gray-800">
                                              {reply.author.username || `${reply.author.first_name} ${reply.author.last_name}`}
                                            </p>
                                            {isReplyOwner && (
                                              <div className="relative">
                                                <button
                                                  type="button"
                                                  onClick={() => setOpenCommentMenuId((prev) => (prev === reply.id ? null : reply.id))}
                                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                                                >
                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                                    <path
                                                      d="M12 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                                                      fill="currentColor"
                                                    />
                                                  </svg>
                                                </button>
                                                {openCommentMenuId === reply.id && (
                                                  <div
                                                    role="menu"
                                                    className="absolute right-0 z-20 mt-2 w-36 rounded-lg border border-gray-100 bg-white p-2 text-xs shadow-lg"
                                                  >
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        handleStartEditComment(reply.id, reply.content || "");
                                                        setOpenCommentMenuId(null);
                                                      }}
                                                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-gray-700 transition hover:bg-gray-100"
                                                    >
                                                      Edit
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        handleDeleteCommentClick(reply.id);
                                                        setOpenCommentMenuId(null);
                                                      }}
                                                      disabled={commentActionPendingId === reply.id}
                                                      className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                      Delete
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          {showReplyContent && (
                                            <p className="mt-1 whitespace-pre-line text-xs text-gray-700">
                                              {reply.content}
                                            </p>
                                          )}
                                          {replyAttachments.length > 0 && (
                                            <div className={`mt-2 grid gap-1.5 ${replyAttachmentGridClass}`}>
                                              {replyAttachments.slice(0, 4).map((url, index) => (
                                                <button
                                                  key={`reply-${reply.id}-media-${index}`}
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    handleOpenGallery({ type: "comment", commentId: reply.id, index });
                                                  }}
                                                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-md"
                                                >
                                                  <Image
                                                    src={url}
                                                    alt={`Reply attachment ${index + 1}`}
                                                    width={200}
                                                    height={150}
                                                    loading="lazy"
                                                    className="h-full w-full object-cover"
                                                  />
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                                            <span>{new Date(reply.created_at).toLocaleString()}</span>
                                            <div className="relative">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  e.preventDefault();
                                                  setOpenCommentReactionPickerId(
                                                    openCommentReactionPickerId === reply.id ? null : reply.id
                                                  );
                                                }}
                                                aria-pressed={replyLiked}
                                                disabled={commentReactionPendingId === reply.id}
                                                aria-expanded={openCommentReactionPickerId === reply.id}
                                                className={[
                                                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition",
                                                  replyLiked
                                                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                                    : "border-gray-200 text-gray-600 hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]",
                                                  commentReactionPendingId === reply.id ? "cursor-not-allowed opacity-60" : "",
                                                ].join(" ")}
                                              >
                                                {reply.user_reaction ? (
                                                  <span className="text-sm">{getReactionEmoji(reply.user_reaction.reaction_type)}</span>
                                                ) : (
                                                  <svg
                                                    width="12"
                                                    height="12"
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
                                                <span className="text-xs font-semibold">{replyLikeCount}</span>
                                              </button>
                                              {openCommentReactionPickerId === reply.id && (
                                                <div onClick={(e) => e.stopPropagation()}>
                                                  <ReactionPicker
                                                    onSelect={(reactionType) => handleToggleCommentReaction(reply, reactionType)}
                                                    onClose={() => setOpenCommentReactionPickerId(null)}
                                                    currentReaction={reply.user_reaction?.reaction_type ?? null}
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Reply Form */}
                            {replyingToId === comment.id && (
                              <div className="mt-4 ml-8 rounded-lg border border-gray-200 bg-white/80 p-3">
                                <form onSubmit={(e) => handleReplySubmit(comment.id, e)}>
                                  <div className="relative">
                                    <textarea
                                      rows={2}
                                      value={replyContent[comment.id] || ""}
                                      onChange={(event) => {
                                        setReplyContent((prev) => ({ ...prev, [comment.id]: event.target.value }));
                                      }}
                                      placeholder="Write a reply..."
                                      className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                                    />
                                  </div>
                                  
                                  {replyAttachments[comment.id] && replyAttachments[comment.id].length > 0 && (
                                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                                      {replyAttachments[comment.id].map((item) => (
                                        <div
                                          key={item.preview}
                                          className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white"
                                        >
                                          <img
                                            src={item.preview}
                                            alt="Reply attachment preview"
                                            className="h-32 w-full object-cover"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveReplyAttachment(comment.id, item.preview)}
                                            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                                            aria-label="Remove attachment"
                                          >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="mt-3 flex items-center gap-2">
                                    <div className="relative">
                                      <button
                                        ref={(el) => {
                                          if (el) replyEmojiButtonsRef.current[comment.id] = el;
                                        }}
                                        type="button"
                                        onClick={() => {
                                          setReplyEmojiPickerOpen((prev) => ({
                                            ...prev,
                                            [comment.id]: !prev[comment.id],
                                          }));
                                        }}
                                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 transition hover:border-[var(--color-primary)]"
                                      >
                                        😀
                                      </button>
                                      <EmojiPickerPopper
                                        open={replyEmojiPickerOpen[comment.id] || false}
                                        onSelect={(emoji) => {
                                          setReplyContent((prev) => ({
                                            ...prev,
                                            [comment.id]: (prev[comment.id] || "") + emoji,
                                          }));
                                          setReplyEmojiPickerOpen((prev) => ({
                                            ...prev,
                                            [comment.id]: false,
                                          }));
                                        }}
                                        onClose={() => {
                                          setReplyEmojiPickerOpen((prev) => ({
                                            ...prev,
                                            [comment.id]: false,
                                          }));
                                        }}
                                        triggerRef={{
                                          current: replyEmojiButtonsRef.current[comment.id],
                                        }}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const input = document.createElement("input");
                                        input.type = "file";
                                        input.accept = "image/*";
                                        input.multiple = true;
                                        input.onchange = (e) => handleReplyFilesAdded(comment.id, e as any);
                                        input.click();
                                      }}
                                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 transition hover:border-[var(--color-primary)]"
                                    >
                                      🖼️
                                    </button>
                                    <div className="flex-1" />
                                    <button
                                      type="button"
                                      onClick={() => handleCancelReply(comment.id)}
                                      className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={replySubmitting[comment.id]}
                                      className="btn-primary px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {replySubmitting[comment.id] ? "Posting..." : "Reply"}
                                    </button>
                                  </div>
                                </form>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    </>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </section>
      {gallery && activeGalleryMedia.length > 0 && galleryMeta && (
        <ImageGallery
          open={true}
          onClose={handleCloseGallery}
          images={activeGalleryMedia}
          currentIndex={gallery.index}
          onNavigate={handleGalleryNavigate}
          onSelect={handleGallerySelect}
          title={galleryMeta.title}
          timestamp={galleryMeta.timestamp}
          caption={
            gallery.type === "post"
              ? post?.content || undefined
              : (post?.comments ?? []).find((c) => c.id === gallery.commentId)?.content || undefined
          }
        />
      )}
      {profileImageGallery && (
        <ImageGallery
          open={true}
          onClose={() => setProfileImageGallery(null)}
          images={[profileImageGallery.image]}
          currentIndex={0}
          title={profileImageGallery.title}
        />
      )}
      <ConfirmationDialog
        isOpen={deleteCommentId !== null}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteCommentId !== null) {
            handleDeleteComment(deleteCommentId);
          }
        }}
        onCancel={() => setDeleteCommentId(null)}
      />
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        shareUrl={post ? `${typeof window !== 'undefined' ? window.location.origin : ''}/app/feed/${post.id}` : ''}
        title="Share Post"
        type="post"
      />
    </RequireAuth>
  );
}

