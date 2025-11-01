"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ProfileCard from "@/components/profile/ProfileCard";
import { useAuth } from "@/lib/auth-context";
import { apiPost } from "@/lib/api";
import type { Post, Visibility } from "@/lib/types";
import { useToast } from "@/components/Toast";
import Image from "next/image";

const NAV_LINKS = [
  { label: "Feed", href: "/app/feed" },
  { label: "Friends", href: "/app/friends" },
  { label: "Friend requests", href: "/app/friend-requests" },
  { label: "Bookmarks", href: "/app/bookmarks" },
  { label: "Notifications", href: "/app/notifications" },
  { label: "Settings", href: "/app/settings" },
];

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, user, logout } = useAuth();
  const toast = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const openCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handlePostCreated = useCallback(
    (post: Post) => {
      toast.show("Post published!");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("post:created", { detail: post }));
      }
    },
    [toast]
  );

  const notifyError = useCallback(
    (message: string) => {
      toast.show(message, "error");
    },
    [toast]
  );

  const toggleNav = useCallback(() => {
    setNavOpen((prev) => !prev);
  }, []);

  const closeNav = useCallback(() => setNavOpen(false), []);
  const lastPathRef = useRef<string>(pathname);

  useEffect(() => {
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname;
      setNavOpen(false);
    }
  }, [pathname]);

  const handleNavigate = useCallback(
    (href: string) => {
      router.push(href);
      closeNav();
    },
    [router, closeNav]
  );

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-32">
      <header className="sticky top-0 z-30 border-b border-white/20 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-primary)] text-white shadow-lg backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-3 sm:hidden">
            <button
              type="button"
              onClick={toggleNav}
              aria-label="Toggle navigation"
              aria-expanded={navOpen}
              className="rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <span className="text-lg font-semibold tracking-tight">Liberty Social</span>
            <button
              type="button"
              onClick={() => handleNavigate("/app/settings")}
              aria-label="View profile"
              className="relative h-9 w-9 overflow-hidden rounded-full border border-white/40 bg-white/20 text-sm font-semibold text-white shadow-sm transition hover:bg-white/30"
            >
              {user ? (
                user.profile_image_url ? (
                  <Image
                    src={user.profile_image_url}
                    alt={user.username || user.email || "Your profile"}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    {(user.username || user.email || "U").charAt(0).toUpperCase()}
                  </span>
                )
              ) : (
                <span className="flex h-full w-full items-center justify-center">?</span>
              )}
            </button>
          </div>

          <div className="hidden items-center justify-between gap-6 py-6 sm:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Welcome to Liberty Social
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Your hub for open conversations</h1>
              <p className="mt-1 text-sm text-white/80">
                Stay connected, share freely, and discover what your community is up to.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleNavigate("/app/settings")}
                className="rounded-full border border-white/40 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/15"
              >
                Manage profile
              </button>
              <button
                onClick={openCreateModal}
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[var(--color-primary)] shadow-sm transition hover:bg-white/90"
              >
                Create post
              </button>
            </div>
          </div>
        </div>
      </header>

      {navOpen && (
        <div className="sm:hidden border-b border-gray-200 bg-white/95 text-[var(--color-primary)] shadow-sm">
          <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4">
            <nav aria-label="Mobile navigation" className="rounded-[16px] bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Navigation
              </p>
              <ul className="space-y-2 text-sm font-medium">
                {NAV_LINKS.map((link) => {
                  const active = pathname?.startsWith(link.href);
                  return (
                    <li key={link.href}>
                      <button
                        onClick={() => handleNavigate(link.href)}
                        className={[
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 transition",
                          active
                            ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] shadow-sm"
                            : "bg-white text-[var(--color-primary)] hover:bg-[var(--metallic-silver)]/40",
                        ].join(" ")}
                      >
                        <span>{link.label}</span>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="text-[var(--color-primary)]"
                        >
                          <path
                            d="M9 5l7 7-7 7"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 lg:flex-row">
        <aside className="hidden lg:block lg:w-64 lg:max-w-[260px]">
          <div className="space-y-6 lg:sticky lg:top-28">
            <ProfileCard />
            <nav
              aria-label="Primary"
              className="space-y-4 rounded-[16px] bg-white/85 p-4 shadow-sm backdrop-blur-md"
            >
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Navigation
                </p>
                <ul className="space-y-2 text-sm font-medium text-[var(--color-primary)]">
                  {NAV_LINKS.map((link) => {
                    const active = pathname?.startsWith(link.href);
                    return (
                      <li key={link.href}>
                        <button
                          onClick={() => handleNavigate(link.href)}
                          className={[
                            "flex w-full items-center justify-between rounded-lg px-3 py-2 transition",
                            active
                              ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] shadow-sm"
                              : "hover:bg-[var(--metallic-silver)]/60",
                          ].join(" ")}
                        >
                          <span>{link.label}</span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-[var(--color-primary)]"
                          >
                            <path
                              d="M9 5l7 7-7 7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <button
                onClick={() => {
                  void logout();
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M15 3H6a2 2 0 00-2 2v14a2 2 0 002 2h9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 17l5-5-5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 12h-9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Sign out
              </button>
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <CreatePostToolbar onOpen={openCreateModal} />
          <div className="mt-4 sm:mt-6">{children}</div>
        </main>
      </div>

      <CreatePostModal
        open={isCreateModalOpen}
        onClose={closeCreateModal}
        accessToken={accessToken}
        onCreated={handlePostCreated}
        onError={notifyError}
      />
      <FloatingCreateButton onOpen={openCreateModal} />
    </div>
  );
}

function CreatePostToolbar({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="rounded-[18px] border border-gray-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Share something new</h2>
          <p className="text-sm text-gray-500">
            Post an update, start a discussion, or share a moment with your network.
          </p>
        </div>
        <button
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-5 py-2 text-sm font-semibold text-white shadow-metallic transition hover:opacity-90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Start a post
        </button>
      </div>
    </div>
  );
}

function CreatePostModal({
  open,
  onClose,
  accessToken,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  accessToken: string | null;
  onCreated: (post: Post) => void;
  onError: (message: string) => void;
}) {
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [mediaInput, setMediaInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const resetForm = () => {
    setContent("");
    setMediaInput("");
    setVisibility("public");
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!accessToken) {
      const message = "Your session expired. Please sign in again to post.";
      setError(message);
      onError(message);
      return;
    }
    if (!content.trim()) {
      setError("Share something before posting.");
      return;
    }

    const payload: Record<string, unknown> = {
      content: content.trim(),
      visibility,
    };
    const mediaUrls = mediaInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (mediaUrls.length > 0) {
      payload.media_urls = mediaUrls;
    }

    try {
      setSubmitting(true);
      setError(null);
      const created = (await apiPost("/posts/", payload, {
        token: accessToken,
        cache: "no-store",
      })) as Post;
      resetForm();
      onClose();
      onCreated(created);
    } catch (err) {
      console.error("Failed to create post:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to share right now. Please try again.";
      setError(message);
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 px-0 sm:items-center sm:px-4"
    >
      <div className="relative flex h-full w-full max-w-none flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-gray-900">Create a post</h2>
          <button
            onClick={handleClose}
            className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:text-gray-700"
            aria-label="Close modal"
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
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
          <label className="flex flex-1 flex-col text-sm font-medium text-gray-700">
            <span className="mb-2">What&apos;s on your mind?</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              placeholder="Start typing to share a thought, idea, or update..."
            />
          </label>

          <label className="flex flex-col text-sm font-medium text-gray-700">
            <span className="mb-2">Who can see this?</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="only_me">Only me</option>
            </select>
          </label>

          <label className="flex flex-col text-sm font-medium text-gray-700">
            <span className="mb-2">Media URLs (optional)</span>
            <input
              value={mediaInput}
              onChange={(e) => setMediaInput(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              placeholder="Paste image URLs separated by commas"
            />
            <span className="mt-2 text-xs text-gray-500">
              Example: https://example.com/photo.jpg, https://example.com/clip.mp4
            </span>
          </label>

          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-6 py-2 text-sm font-semibold text-white shadow-metallic transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Posting..." : "Share"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FloatingCreateButton({ onOpen }: { onOpen: () => void }) {
  const pointerStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const movedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 16, y: 160 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const buttonSize = 64;
    const clampPosition = (prev: { x: number; y: number }) => ({
      x: Math.min(Math.max(16, prev.x), Math.max(16, window.innerWidth - buttonSize - 16)),
      y: Math.min(Math.max(16, prev.y), Math.max(16, window.innerHeight - buttonSize - 16)),
    });

    const frame = requestAnimationFrame(() => {
      setPosition(
        clampPosition({
          x: window.innerWidth - buttonSize - 16,
          y: window.innerHeight - buttonSize - 24,
        })
      );
      setReady(true);
    });

    const handleResize = () => {
      setPosition((prev) => clampPosition(prev));
    };

    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    pointerStart.current = { x: event.clientX, y: event.clientY };
    posStart.current = { x: rect.left, y: rect.top };
    draggingRef.current = true;
    movedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    event.preventDefault();
    const deltaX = event.clientX - pointerStart.current.x;
    const deltaY = event.clientY - pointerStart.current.y;
    if (!movedRef.current && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
      movedRef.current = true;
    }
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const buttonWidth = rect.width;
    const buttonHeight = rect.height;
    const minX = 16;
    const maxX = Math.max(minX, window.innerWidth - buttonWidth - 16);
    const minY = 16;
    const maxY = Math.max(minY, window.innerHeight - buttonHeight - 24);
    const nextX = Math.min(Math.max(posStart.current.x + deltaX, minX), maxX);
    const nextY = Math.min(Math.max(posStart.current.y + deltaY, minY), maxY);
    setPosition({ x: nextX, y: nextY });
  };

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>, shouldTrigger = true) => {
    if (!draggingRef.current) return;
    event.preventDefault();
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (shouldTrigger && !movedRef.current) {
      onOpen();
    }
    movedRef.current = false;
  };

  if (!ready) return null;

  return (
    <button
      type="button"
      aria-label="Create post"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishDrag(event, true)}
      onPointerCancel={(event) => finishDrag(event, false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-metallic transition hover:scale-105 active:scale-95 touch-action-none cursor-grab active:cursor-grabbing"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
