"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import type { Post } from "@/lib/types";
import { useToast } from "@/components/Toast";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { SavePostToFolderModal } from "@/components/SavePostToFolderModal";

interface PostActionsMenuProps {
  post: Post;
  accessToken: string | null;
  currentUserId?: string | null;
  onUpdated: (post: Post) => void;
  onDeleted: (postId: number) => void;
}

export function PostActionsMenu({
  post,
  accessToken,
  currentUserId,
  onUpdated,
  onDeleted,
}: PostActionsMenuProps) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isOwner = useMemo(() => {
    if (!currentUserId) return false;
    return String(post.author?.id) === String(currentUserId);
  }, [currentUserId, post.author?.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const toggleBookmark = useCallback(async () => {
    if (!accessToken) {
      toast.show("Please sign in to save posts.", "error");
      setMenuOpen(false);
      return;
    }
    setPending(true);
    try {
      if (post.bookmarked && post.bookmark_id) {
        await apiDelete(`/bookmarks/${post.bookmark_id}/`, {
          token: accessToken,
          cache: "no-store",
        });
        onUpdated({ ...post, bookmarked: false, bookmark_id: null });
        toast.show("Post removed from saves.");
      } else {
        setShowSaveModal(true);
      }
    } catch (err) {
      console.error(err);
      toast.show("Unable to update save right now.", "error");
    } finally {
      setPending(false);
      setMenuOpen(false);
    }
  }, [accessToken, onUpdated, post, toast]);

  const handleDeleteClick = useCallback(() => {
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!accessToken) return;
    setShowDeleteConfirm(false);
    setPending(true);
    try {
      await apiDelete(`/posts/${post.id}/`, {
        token: accessToken,
        cache: "no-store",
      });
      onDeleted(post.id);
      toast.show("Post deleted.");
    } catch (err) {
      console.error(err);
      toast.show("Unable to delete this post.", "error");
    } finally {
      setPending(false);
    }
  }, [accessToken, onDeleted, post.id, toast]);

  const handleEditSubmit = useCallback(async () => {
    if (!accessToken) return;
    const trimmed = editContent.trim();
    if (!trimmed) {
      toast.show("Post content cannot be empty.", "error");
      return;
    }
    setPending(true);
    try {
      const updated = (await apiPatch(`/posts/${post.id}/`, { content: trimmed }, {
        token: accessToken,
        cache: "no-store",
      })) as Post;
      onUpdated({ ...post, ...updated, content: trimmed });
      toast.show("Post updated.");
      setEditing(false);
      setMenuOpen(false);
    } catch (err) {
      console.error(err);
      toast.show("Unable to update post.", "error");
    } finally {
      setPending(false);
    }
  }, [accessToken, editContent, onUpdated, post, toast]);

  const handleSaveToFolder = useCallback(() => {
    if (!accessToken) {
      toast.show("Please sign in to save posts.", "error");
      return;
    }
    setShowSaveModal(true);
    setMenuOpen(false);
  }, [accessToken, toast]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
      >
        <span className="sr-only">Open post actions</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
            fill="currentColor"
          />
        </svg>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-100 bg-white p-2 text-sm shadow-lg"
        >
          <button
            type="button"
            onClick={handleSaveToFolder}
            disabled={pending}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {post.bookmarked ? "Manage saved folders" : "Save post"}
          </button>

          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditContent(post.content);
                  setEditing(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-gray-700 transition hover:bg-gray-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14.06 6.19l2.12-2.12a1.5 1.5 0 012.12 0l1.63 1.63a1.5 1.5 0 010 2.12l-2.12 2.12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Edit post
              </button>
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={pending}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 7h14M10 11v6M14 11v6M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Delete post
              </button>
            </>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Edit post</h2>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setPending(false);
                }}
                className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <textarea
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              rows={6}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setPending(false);
                }}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSubmit}
                disabled={pending}
                className="rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-5 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      <SavePostToFolderModal
        open={showSaveModal}
        postId={post.id}
        accessToken={accessToken}
        onClose={() => setShowSaveModal(false)}
        onSaved={() => {
          onUpdated({ ...post, bookmarked: true, bookmark_id: post.id });
          toast.show("Post saved to folder.");
        }}
      />
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
