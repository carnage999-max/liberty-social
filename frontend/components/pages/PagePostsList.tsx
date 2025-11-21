"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { apiDelete, apiGet } from "@/lib/api";
import { Post } from "@/lib/types";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/components/Toast";
import { EmojiPickerPopper } from "@/components/EmojiPickerPopper";
import ImageGallery from "@/components/ImageGallery";
import PagePostEditModal from "./PagePostEditModal";
import ConfirmationDialog from "@/components/ConfirmationDialog";

interface PagePostsListProps {
  pageId: number;
  accessToken: string;
  canManage: boolean;
  onPostDeleted?: () => void;
  refreshTrigger?: number; // Increment to trigger refresh
}

const REACTION_TYPE_TO_EMOJI: Record<string, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  sad: "😢",
  angry: "😠",
};

function getReactionEmoji(reactionType: string): string {
  if (REACTION_TYPE_TO_EMOJI[reactionType]) {
    return REACTION_TYPE_TO_EMOJI[reactionType];
  }
  return reactionType;
}

interface ReactionBreakdown {
  total: number;
  byType: Record<string, number>;
}

function summariseReactions(reactions: any[]): ReactionBreakdown {
  return reactions.reduce<ReactionBreakdown>(
    (acc, reaction) => {
      acc.total += 1;
      const type = getReactionEmoji(reaction.reaction_type);
      acc.byType[type] = (acc.byType[type] || 0) + 1;
      return acc;
    },
    { total: 0, byType: {} }
  );
}

export default function PagePostsList({
  pageId,
  accessToken,
  canManage,
  onPostDeleted,
  refreshTrigger = 0,
}: PagePostsListProps) {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<number | null>(null);
  const [gallery, setGallery] = useState<{ postId: number; index: number } | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const emojiButtonsRef = useRef<Record<number, HTMLButtonElement>>({});

  // Load posts
  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        const data = await apiGet<Post[]>(`/pages/${pageId}/posts/`, {
          token: accessToken,
        });
        setPosts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load page posts:", error);
        toast.show("Failed to load posts", "error");
      } finally {
        setLoading(false);
      }
    };

    if (pageId && accessToken) {
      loadPosts();
    }
  }, [pageId, accessToken, refreshTrigger, toast]);

  const handleDeletePost = useCallback(
    async (postId: number) => {
      try {
        await apiDelete(`/posts/${postId}/`, { token: accessToken });
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.show("Post deleted successfully", "success");
        if (onPostDeleted) {
          onPostDeleted();
        }
      } catch (error) {
        console.error("Failed to delete post:", error);
        toast.show("Failed to delete post", "error");
      } finally {
        setDeleteConfirmPostId(null);
      }
    },
    [accessToken, toast, onPostDeleted]
  );

  const openGallery = (post: Post, imageIndex: number) => {
    if (post.media_urls && post.media_urls.length > 0) {
      setGalleryImages(post.media_urls);
      setGallery({ postId: post.id, index: imageIndex });
    }
  };

  const closeGallery = () => {
    setGallery(null);
    setGalleryImages([]);
  };

  const navigateGallery = (direction: "prev" | "next") => {
    if (!gallery) return;
    const newIndex =
      direction === "prev"
        ? (gallery.index - 1 + galleryImages.length) % galleryImages.length
        : (gallery.index + 1) % galleryImages.length;
    setGallery({ ...gallery, index: newIndex });
  };

  const reactionBreakdown = (post: Post) => {
    return summariseReactions(post.reactions || []);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-(--color-deep-navy)"></div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-gray-600">No posts yet. Be the first to share something!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {posts.map((post) => {
          const reactions = reactionBreakdown(post);
          const authorName =
            post.author_type === "page" && post.page
              ? post.page.name
              : `${post.author?.first_name || ""} ${post.author?.last_name || ""}`.trim();
          const authorImage =
            post.author_type === "page" && post.page
              ? post.page.profile_image_url
              : post.author?.profile_image_url;

          return (
            <div
              key={post.id}
              className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm overflow-hidden"
            >
              {/* Post header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  {authorImage ? (
                    <img
                      src={authorImage}
                      alt={authorName}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{authorName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(post.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Manage button for admins */}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setEditingPostId(post.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    title="Edit or delete post"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Post content */}
              <p className="text-gray-700 mb-4 whitespace-pre-line leading-relaxed">{post.content}</p>

              {/* Post media */}
              {post.media_urls && post.media_urls.length > 0 && (
                <div className="mb-4 grid gap-2 overflow-hidden rounded-lg">
                  {post.media_urls.length === 1 ? (
                    <button
                      type="button"
                      onClick={() => openGallery(post, 0)}
                      className="group relative aspect-video overflow-hidden rounded-lg bg-gray-100"
                    >
                      <img
                        src={post.media_urls[0]}
                        alt="Post media"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </button>
                  ) : (
                    <div className="grid gap-1 grid-cols-2 sm:grid-cols-3">
                      {post.media_urls?.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => openGallery(post, idx)}
                          className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100"
                        >
                          <img
                            src={url}
                            alt={`Post media ${idx + 1}`}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                          {idx === 3 && (post.media_urls?.length ?? 0) > 4 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <span className="text-sm font-semibold text-white">
                                +{(post.media_urls?.length ?? 0) - 4}
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Post reactions and metadata */}
              <div className="mb-3 flex items-center gap-3 border-b border-gray-100 pb-3 text-sm text-gray-600">
                {reactions.total > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="flex gap-0.5">
                      {Object.entries(reactions.byType)
                        .slice(0, 3)
                        .map(([emoji]) => (
                          <span key={emoji} className="text-sm">
                            {emoji}
                          </span>
                        ))}
                    </div>
                    <span className="text-xs text-gray-500">{reactions.total}</span>
                  </div>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  className="text-gray-600 hover:text-gray-900"
                  title="View post details"
                >
                  <Link href={`/app/posts/${post.id}`} className="hover:underline">
                    View Post
                  </Link>
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    ref={(el) => {
                      if (el) emojiButtonsRef.current[post.id] = el;
                    }}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 transition hover:border-(--color-deep-navy)"
                  >
                    👍 React
                  </button>
                  {/* Emoji picker would go here if implementing reactions */}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingPostId !== null && (
        <PagePostEditModal
          postId={editingPostId}
          pageId={pageId}
          accessToken={accessToken}
          onClose={() => setEditingPostId(null)}
          onPostUpdated={(updatedPost: Post) => {
            setPosts((prev) =>
              prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
            );
            setEditingPostId(null);
          }}
          onPostDeleted={(postId: number) => {
            setDeleteConfirmPostId(null);
            handleDeletePost(postId);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmPostId !== null}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmPostId !== null) {
            handleDeletePost(deleteConfirmPostId);
          }
        }}
        onCancel={() => setDeleteConfirmPostId(null)}
      />

      {/* Gallery */}
      {gallery && galleryImages.length > 0 && (
        <ImageGallery
          open={true}
          onClose={closeGallery}
          images={galleryImages}
          currentIndex={gallery.index}
          onNavigate={(direction) => navigateGallery(direction)}
          title={
            posts.find((p) => p.id === gallery.postId)?.page?.name || "Page Post"
          }
        />
      )}
    </>
  );
}
