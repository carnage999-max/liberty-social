"use client";

import { useState, useEffect, useRef, ChangeEvent, FormEvent } from "react";
import { useToast } from "@/components/Toast";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";
import { Post } from "@/lib/types";
import ConfirmationDialog from "@/components/ConfirmationDialog";

interface PagePostEditModalProps {
  postId: number;
  pageId: number;
  accessToken: string;
  onClose: () => void;
  onPostUpdated: (post: Post) => void;
  onPostDeleted: (postId: number) => void;
}

type MediaItem = { file: File; preview: string } | { url: string };

const MAX_MEDIA_ITEMS = 6;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

function isNewFile(item: MediaItem): item is { file: File; preview: string } {
  return "file" in item;
}

function isExistingUrl(item: MediaItem): item is { url: string } {
  return "url" in item;
}

export default function PagePostEditModal({
  postId,
  pageId,
  accessToken,
  onClose,
  onPostUpdated,
  onPostDeleted,
}: PagePostEditModalProps) {
  const toast = useToast();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("private");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load post data
  useEffect(() => {
    const loadPost = async () => {
      setLoading(true);
      try {
        const data = await apiGet<Post>(`/posts/${postId}/`, {
          token: accessToken,
        });
        setPost(data);
        setContent(data.content);
        setVisibility((data.visibility as "public" | "followers" | "private") || "public");
        if (data.media_urls && data.media_urls.length > 0) {
          setMediaItems(
            data.media_urls.map((url) => ({
              url,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load post:", err);
        toast.show("Failed to load post", "error");
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId, accessToken, onClose, toast]);

  const handleSelectMedia = () => {
    fileInputRef.current?.click();
  };

  const handleFilesAdded = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setError(null);

    const existing = mediaItems.length;
    const remaining = MAX_MEDIA_ITEMS - existing;

    if (remaining <= 0) {
      const message = `You can attach up to ${MAX_MEDIA_ITEMS} images per post.`;
      setError(message);
      toast.show(message, "error");
      event.target.value = "";
      return;
    }

    const accepted = files.slice(0, remaining);
    const nextItems = accepted.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setMediaItems((prev) => [...prev, ...nextItems]);

    if (files.length > remaining) {
      const message = `Only the first ${remaining} image${remaining === 1 ? "" : "s"} were attached.`;
      toast.show(message, "error");
    }

    event.target.value = "";
  };

  const handleRemoveMedia = (item: MediaItem) => {
    setMediaItems((prev) => {
      if (isNewFile(item)) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter((m) => m !== item);
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (submitting) return;

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError("Share something before posting.");
      return;
    }

    setSubmitting(true);
    try {
      setError(null);
      const payload: Record<string, unknown> = {
        content: trimmedContent,
        visibility,
      };

      // Handle media uploads
      const newFiles = mediaItems.filter(isNewFile);
      const existingUrls = mediaItems.filter(isExistingUrl).map((m) => m.url);

      if (newFiles.length > 0) {
        const formData = new FormData();
        newFiles.forEach(({ file }) => formData.append("files", file));

        let uploadResponse: Response;
        try {
          uploadResponse = await fetch(`${API_BASE}/uploads/images/`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
          });
        } catch (err) {
          throw new Error("Unable to upload media right now. Please try again.");
        }

        const uploadData = await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok || !uploadData) {
          const message =
            (uploadData && (uploadData.detail || uploadData.message)) ||
            "We couldn't upload your media. Please try again.";
          throw new Error(message);
        }

        const urls = Array.isArray(uploadData.urls)
          ? uploadData.urls
          : uploadData.url
          ? [uploadData.url]
          : [];

        if (urls.length === 0 && newFiles.length > 0) {
          throw new Error("Upload succeeded without media URLs. Please retry.");
        }

        payload.media_urls = [...existingUrls, ...urls];
      } else {
        payload.media_urls = existingUrls.length > 0 ? existingUrls : [];
      }

      // Update post
      const updated = await apiPatch<Post>(`/posts/${postId}/`, payload, {
        token: accessToken,
        cache: "no-store",
      });

      toast.show("Post updated successfully!", "success");
      onPostUpdated(updated);
    } catch (err) {
      console.error("Failed to update post:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to update post right now. Please try again.";
      setError(message);
      toast.show(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await apiDelete(`/posts/${postId}/`, { token: accessToken });
      toast.show("Post deleted successfully", "success");
      onPostDeleted(postId);
    } catch (err) {
      console.error("Failed to delete post:", err);
      toast.show("Failed to delete post", "error");
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-(--color-deep-navy)"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 sm:p-4 overflow-y-auto">
        <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl rounded-none sm:rounded-3xl border border-(--color-border) bg-white shadow text-black flex flex-col overflow-hidden my-auto">
          {/* Header */}
          <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-6 border-b border-gray-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2 sm:px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M15 19l-7-7 7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <header className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-black">Edit Post</h1>
              <p className="text-xs sm:text-sm text-gray-600">Update your page post.</p>
            </header>

            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="inline-flex items-center gap-2 rounded-full border border-red-200 px-2 sm:px-3 py-1 text-sm text-red-600 hover:bg-red-50 shrink-0"
              title="Delete post"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form className="space-y-3 sm:space-y-4 p-4 sm:p-6 overflow-y-auto flex-1" onSubmit={handleSubmit}>
            {/* Content textarea */}
            <label className="flex flex-col text-sm font-medium text-black">
              <span className="mb-2">Post content</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-(--color-deep-navy) focus:ring-2 focus:ring-(--color-deep-navy)/20 text-gray-700"
                placeholder="Edit your post..."
                disabled={submitting}
              />
            </label>

            {/* Media section */}
            <label className="flex flex-col text-sm font-medium text-black">
              <span className="mb-2">Media</span>
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-4">
                {mediaItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 text-center text-gray-500">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 5h18M3 19h18M3 5l4 7 4-4 4 6 4-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p className="text-sm">
                      Add up to {MAX_MEDIA_ITEMS} images to your post.
                    </p>
                    <button
                      type="button"
                      onClick={handleSelectMedia}
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-(--color-deep-navy) px-4 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:opacity-60"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 5v14M5 12h14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      Upload images
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {mediaItems.map((item) => (
                        <div
                          key={isNewFile(item) ? item.preview : item.url}
                          className="group relative aspect-square overflow-hidden rounded-lg bg-white shadow-sm"
                        >
                          <img
                            src={isNewFile(item) ? item.preview : item.url}
                            alt="Post media"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveMedia(item)}
                            disabled={submitting}
                            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-60"
                            aria-label="Remove image"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M6 6l12 12M6 18L18 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {mediaItems.length < MAX_MEDIA_ITEMS && (
                        <button
                          type="button"
                          onClick={handleSelectMedia}
                          disabled={submitting}
                          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-500 transition hover:border-(--color-deep-navy) hover:text-(--color-deep-navy) disabled:opacity-60"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 5v14M5 12h14"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                          Add more
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      JPEG, PNG, or GIF files. Max {MAX_MEDIA_ITEMS} per post.
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesAdded}
                disabled={submitting}
              />
            </label>

            {/* Visibility */}
            <label className="flex flex-col text-sm font-medium text-black">
              <span className="mb-2">Who can see this?</span>
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "public" | "followers" | "private")
                }
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-(--color-deep-navy) focus:ring-2 focus:ring-(--color-deep-navy)/20 text-gray-700"
                disabled={submitting}
              >
                <option value="public">Public</option>
                <option value="followers">Followers</option>
                <option value="private">Private</option>
              </select>
            </label>

            {/* Error */}
            {error && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            {/* Buttons */}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-full border border-gray-300 px-4 sm:px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-70 w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="rounded-full bg-(--color-deep-navy) px-4 sm:px-5 py-2 text-sm font-semibold text-white transition hover:bg-(--color-deeper-navy) disabled:opacity-70 w-full sm:w-auto"
              >
                {submitting ? "Updating..." : "Update Post"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteConfirm}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleDeletePost}
        onCancel={() => setDeleteConfirm(false)}
      />
    </>
  );
}
