"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfileImageModal from "@/components/profile/ProfileImageModal";
import { useAuth } from "@/lib/auth-context";
import { API_BASE, apiPost } from "@/lib/api";
import type { Post, Visibility, FriendRequest } from "@/lib/types";
import { useToast } from "@/components/Toast";
import Image from "next/image";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import { useNotifications } from "@/hooks/useNotifications";

const NAV_LINKS = [
  {
    label: "Feed",
    href: "/app/feed",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 4h6v6H4zM4 14h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Friends",
    href: "/app/friends",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM20 8v6M23 11h-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Friend requests",
    href: "/app/friend-requests",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M16 3h5v5M21 3l-7 7M8 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM3 21a5 5 0 0 1 10 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Bookmarks",
    href: "/app/bookmarks",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 3h12a1 1 0 0 1 1 1v16l-7-3-7 3V4a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Notifications",
    href: "/app/notifications",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
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
  const [isDesktop, setIsDesktop] = useState(false);
  const [showCompactLogo, setShowCompactLogo] = useState(false);
  const [mobileProfileModalOpen, setMobileProfileModalOpen] = useState(false);
  const { count: incomingFriendRequests } = usePaginatedResource<FriendRequest>(
    "/auth/friend-requests/",
    {
      enabled: !!accessToken,
      query: { direction: "incoming", page_size: 1 },
    }
  );
  const { unreadCount: notificationUnreadCount } = useNotifications();

  const openCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handlePostCreated = useCallback(
    (post: Post) => {
      toast.show(
        <span className="flex items-center gap-3">
          <span>Post published!</span>
          <button
            type="button"
            onClick={() => {
              router.push(`/app/feed/${post.id}`);
            }}
            className="rounded-full border border-transparent bg-(--color-deep-navy) px-3 py-1 text-xs font-semibold text-white transition hover:bg-(--color-deeper-navy)"
          >
            View post
          </button>
        </span>,
        "success",
        15000
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("post:created", { detail: post }));
      }
    },
    [router, toast]
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
    if (typeof window === "undefined") return;
    const updateIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    updateIsDesktop();
    window.addEventListener("resize", updateIsDesktop);
    return () => window.removeEventListener("resize", updateIsDesktop);
  }, []);

  useEffect(() => {
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname;
      setNavOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleScroll = () => {
      if (window.innerWidth >= 640) {
        setShowCompactLogo(false);
        return;
      }
      setShowCompactLogo(window.scrollY > 24);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavigate = useCallback(
    (href: string) => {
      router.push(href);
      closeNav();
    },
    [router, closeNav]
  );

  // compute a best-effort href to the current user's public profile
  const myProfileHref = (() => {
    try {
      const uid = (user as any)?.id ?? (typeof window !== "undefined" ? localStorage.getItem("userId") : null);
      return uid ? `/app/users/${uid}` : undefined;
    } catch {
      return undefined;
    }
  })();

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-32">
      <header className="sticky top-0 z-30 header-bar text-white shadow-lg backdrop-blur-sm">
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
            <button
              type="button"
              onClick={() => handleNavigate("/app/feed")}
              className={`inline-flex items-center justify-center text-lg font-semibold tracking-tight text-white transition hover:opacity-80 focus:outline-none ${
                showCompactLogo ? "h-9 w-9 rounded-full bg-white/15" : "px-2"
              }`}
            >
              {showCompactLogo ? (
                <Image
                  src="/icon.png"
                  alt="Liberty Social"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-cover rounded-2xl"
                  priority
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span>Liberty Social</span>
                  <span className="waving-flag text-xl">🇺🇸</span>
                </div>
              )}
            </button>
            <button
                type="button"
                onClick={() => {
                  if (!user) {
                    if (myProfileHref) {
                      router.push(myProfileHref);
                    } else {
                      handleNavigate("/app/settings");
                    }
                    return;
                  }
                  setMobileProfileModalOpen(true);
                }}
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

          <div className="hidden items-center justify-between gap-6 py-4 sm:flex">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white/20 shadow-sm">
                <Image
                  src="/images/logo.jpeg"
                  alt="Liberty Social"
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold sm:text-2xl">Liberty Social</h1>
                <p className="text-sm text-white/80">
                  Your hub for open conversations
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (myProfileHref) router.push(myProfileHref);
                  else handleNavigate("/app/settings");
                }}
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
                      priority
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
              <button
                onClick={openCreateModal}
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[var(--color-deep-navy)] shadow-sm transition hover:bg-white/90"
              >
                Create post
              </button>
            </div>
          </div>
        </div>
      </header>

      {navOpen && (
        <div className="sm:hidden border-b border-gray-200 bg-white/95 text-[var(--color-deep-navy)] shadow-sm">
          <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4">
            <nav aria-label="Mobile navigation" className="rounded-[16px] bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Navigation
              </p>
              <ul className="space-y-2 text-sm font-medium">
                {NAV_LINKS.map((link) => {
                  const active = pathname?.startsWith(link.href);
                  const badgeCount = link.href === "/app/friend-requests" ? incomingFriendRequests : 0;
                  const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);
                  return (
                    <li key={link.href}>
                      <button
                        onClick={() => handleNavigate(link.href)}
                        className={[
                          "group flex w-full items-center justify-between rounded-lg px-3 py-2 transition",
                          active
                            ? "bg-[var(--color-deep-navy)]/15 text-[var(--color-deep-navy)] shadow-sm"
                            : "bg-white text-[var(--color-deep-navy)] hover:bg-[var(--metallic-silver)]/40",
                          ].join(" ")}
                      >
                        <span className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-deep-navy)]/10 text-[var(--color-deep-navy)] transition group-hover:bg-[var(--color-deep-navy)]/15 group-hover:text-[var(--color-deep-navy)]">
                            {link.icon}
                          </span>
                          <span>{link.label}</span>
                        </span>
                        {badgeCount > 0 && (
                          <span className="ml-3 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-rose-500 px-2 text-xs font-semibold text-white">
                            {badgeLabel}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    void logout();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-500">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9"
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
                  </span>
                  Sign out
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 lg:flex-row">
        {isDesktop && (
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
                  <ul className="space-y-2 text-sm font-medium text-[var(--color-deep-navy)]">
                    {NAV_LINKS.map((link) => {
                      const active = pathname?.startsWith(link.href);
                      let badgeCount = 0;
                      if (link.href === "/app/friend-requests") {
                        badgeCount = incomingFriendRequests;
                      } else if (link.href === "/app/notifications") {
                        badgeCount = notificationUnreadCount;
                      }
                      const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);
                      return (
                        <li key={link.href}>
                          <button
                            onClick={() => handleNavigate(link.href)}
                            className={[
                              "group flex w-full items-center justify-between rounded-lg px-3 py-2 transition",
                              active
                                ? "bg-[var(--color-deep-navy)]/15 text-[var(--color-deep-navy)] shadow-sm"
                                : "hover:bg-[var(--metallic-silver)]/60",
                            ].join(" ")}
                          >
                            <span className="flex items-center gap-2 text-[var(--color-deep-navy)]">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-deep-navy)]/10 text-[var(--color-deep-navy)] transition group-hover:bg-[var(--color-deep-navy)]/20">
                                {link.icon}
                              </span>
                              <span>{link.label}</span>
                            </span>
                            {badgeCount > 0 && (
                              <span className="ml-3 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-rose-500 px-2 text-xs font-semibold text-white">
                                {badgeLabel}
                              </span>
                            )}
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-100"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-500">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9"
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
                  </span>
                  Sign out
                </button>
              </nav>
            </div>
          </aside>
        )}

        <main className="flex-1 min-w-0">
          {!isDesktop && (
            <div className="mb-6 lg:hidden">
              <ProfileCard profileHref={myProfileHref} className="items-start text-left sm:items-center sm:text-center" />
            </div>
          )}
          <CreatePostToolbar onOpen={openCreateModal} />
          <div className="mt-4 sm:mt-6">{children}</div>
        </main>
      </div>

      <ProfileImageModal
        open={mobileProfileModalOpen}
        onClose={() => setMobileProfileModalOpen(false)}
        currentImageUrl={user?.profile_image_url}
        userId={user?.id}
      />

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
          className="inline-flex items-center justify-center gap-2 rounded-full btn-primary px-5 py-2 text-sm font-semibold text-white shadow-metallic transition hover:opacity-90"
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
  type MediaItem = { file: File; preview: string };
  const MAX_MEDIA_ITEMS = 6;
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const resetForm = () => {
    setMediaItems((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.preview));
      return [];
    });
    setContent("");
    setVisibility("public");
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSelectMedia = () => {
    if (!accessToken) {
      const message = "You need to sign in to attach media.";
      setError(message);
      onError(message);
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
      onError(message);
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
      onError(`Only the first ${remaining} image${remaining === 1 ? "" : "s"} were attached.`);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!accessToken) {
      const message = "Your session expired. Please sign in again to post.";
      setError(message);
      onError(message);
      return;
    }
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError("Share something before posting.");
      return;
    }

    const payload: Record<string, unknown> = {
      content: trimmedContent,
      visibility,
    };

    try {
      setSubmitting(true);
      setError(null);
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

      const created = (await apiPost("/posts/", payload, {
        token: accessToken,
        cache: "no-store",
      })) as Post;
      resetForm();
      onClose();
      onCreated(created);
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
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-deep-navy)] focus:ring-2 focus:ring-[var(--color-deep-navy)]/20"
              placeholder="Start typing to share a thought, idea, or update..."
            />
          </label>

          <div className="flex flex-col text-sm font-medium text-gray-700">
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
                      className="inline-flex items-center justify-center gap-2 rounded-full btn-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90"
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
                      <div key={item.preview} className="group relative aspect-square overflow-hidden rounded-lg bg-white shadow-sm">
                        <img src={item.preview} alt="Selected media" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(item.preview)}
                          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
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
                        className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-500 transition hover:border-[var(--color-deep-navy)] hover:text-[var(--color-deep-navy)]"
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
            />
          </div>

          <label className="flex flex-col text-sm font-medium text-gray-700">
            <span className="mb-2">Who can see this?</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-deep-navy)] focus:ring-2 focus:ring-[var(--color-deep-navy)]/20"
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="only_me">Only me</option>
            </select>
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
              className="rounded-full btn-primary px-6 py-2 text-sm font-semibold text-white shadow-metallic transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
      className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full btn-primary text-white shadow-metallic transition hover:scale-105 active:scale-95 touch-action-none cursor-grab active:cursor-grabbing"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
