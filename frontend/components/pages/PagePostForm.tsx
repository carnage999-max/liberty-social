"use client";

import { useState, ChangeEvent, FormEvent, useRef } from "react";
import { useToast } from "@/components/Toast";
import { apiPost } from "@/lib/api";

interface PagePostFormProps {
  pageId: number;
  accessToken: string;
  onPostCreated?: () => void;
}

type MediaItem = { file: File; preview: string };

const MAX_MEDIA_ITEMS = 6;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

export default function PagePostForm({ pageId, accessToken, onPostCreated }: PagePostFormProps) {
  const toast = useToast();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("private");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetForm = () => {
    setMediaItems((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.preview));
      return [];
    });
    setContent("");
    setVisibility("private");
    setError(null);
  };

  const handleSelectMedia = () => {
    if (!accessToken) {
      const message = "You need to sign in to attach media.";
      setError(message);
      toast.show(message, "error");
      return;
    }
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

  const handleRemoveMedia = (preview: string) => {
    setMediaItems((prev) => {
      const target = prev.find((item) => item.preview === preview);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((item) => item.preview !== preview);
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!accessToken) {
      const message = "Your session expired. Please sign in again to post.";
      setError(message);
      toast.show(message, "error");
      return;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError("Share something before posting.");
      return;
    }

    setIsSubmitting(true);
    try {
      setError(null);
      const payload: Record<string, unknown> = {
        content: trimmedContent,
        page_id: pageId,
        visibility,
      };

      // Upload media if any
      if (mediaItems.length > 0) {
        const formData = new FormData();
        mediaItems.forEach(({ file }) => formData.append("files", file));

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

        if (!urls.length) {
          throw new Error("Upload succeeded without media URLs. Please retry.");
        }

        payload.media_urls = urls;
      }

      // Create post
      await apiPost("/posts/", payload, {
        token: accessToken,
        cache: "no-store",
      });

      toast.show("Page post created successfully!", "success");
      resetForm();

      if (onPostCreated) {
        onPostCreated();
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Failed to create post:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to share right now. Please try again.";
      setError(message);
      toast.show(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-black">Create Page Post</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Content textarea */}
        <label className="flex flex-col text-sm font-medium text-black">
          <span className="mb-2">What would you like to share?</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-(--color-deep-navy) focus:ring-2 focus:ring-(--color-deep-navy)/20 text-gray-700"
            placeholder="Start typing to share a thought, idea, or update..."
            disabled={isSubmitting}
          />
        </label>

        {/* Media upload section */}
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
                  Add up to {MAX_MEDIA_ITEMS} images. They&apos;ll upload securely to Liberty Social.
                </p>
                <button
                  type="button"
                  onClick={handleSelectMedia}
                  disabled={isSubmitting}
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
                      key={item.preview}
                      className="group relative aspect-square overflow-hidden rounded-lg bg-white shadow-sm"
                    >
                      <img
                        src={item.preview}
                        alt="Selected media"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMedia(item.preview)}
                        disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
            disabled={isSubmitting}
          />
        </label>

        {/* Visibility selector */}
        <label className="flex flex-col text-sm font-medium text-black">
          <span className="mb-2">Who can see this?</span>
          <select
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as "public" | "followers" | "private")
            }
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-(--color-deep-navy) focus:ring-2 focus:ring-(--color-deep-navy)/20 text-gray-700"
            disabled={isSubmitting}
          >
            <option value="public">Public</option>
            <option value="followers">Followers</option>
            <option value="private">Private</option>
          </select>
        </label>

        {/* Error message */}
        {error && (
          <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Submit buttons */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              resetForm();
            }}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-70"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="rounded-lg bg-(--color-primary) px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-70"
          >
            {isSubmitting ? "Publishing..." : "Publish Post"}
          </button>
        </div>
      </form>
    </div>
  );
}
