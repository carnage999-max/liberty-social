"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { useAuth } from "@/lib/auth-context";
import ProfileImageModal from "@/components/profile/ProfileImageModal";
import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api";
import type { Post, UserProfileOverview } from "@/lib/types";
import { UserActionsMenu } from "@/components/profile/UserActionsMenu";

type PendingAction =
  | "friend"
  | "cancel"
  | "accept"
  | "decline"
  | "unfriend"
  | "block"
  | "unblock"
  | null;

type ProfileTab = "overview" | "photos" | "posts";

export default function UserProfilePage() {
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const normalizedRawId = useMemo(() => {
    if (!rawId) return "";
    return Array.isArray(rawId) ? rawId[0] ?? "" : rawId;
  }, [rawId]);

  const profileId = useMemo(() => {
    if (!normalizedRawId) return null;
    const trimmed = normalizedRawId.trim();
    if (!trimmed || trimmed === "undefined") return null;
    return trimmed;
  }, [normalizedRawId]);

  const { accessToken } = useAuth();
  const toast = useToast();
  const [overview, setOverview] = useState<UserProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: "danger" | "default";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [profileImageModalOpen, setProfileImageModalOpen] = useState(false);

  const fetchOverview = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken || !profileId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<UserProfileOverview>(`/auth/user/${profileId}/overview/`, {
        token: accessToken,
        cache: "no-store",
        signal,
      });
      setOverview(data);
    } catch (err) {
      if ((err as any)?.name === "AbortError") return;
      if (err instanceof ApiError) {
        if (err.status === 404) setError("We couldn't find that user.");
        else if (err.status === 403) setError("You don't have permission to view this profile.");
        else setError(err.message || "Unable to load this profile right now.");
      } else {
        setError("Unable to load this profile right now.");
      }
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, profileId]);

  useEffect(() => {
    if (!accessToken) return;
    if (!profileId) {
      setError("We couldn't identify that profile.");
      setOverview(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    fetchOverview(controller.signal);
    return () => controller.abort();
  }, [accessToken, profileId, fetchOverview]);

  const displayName = useMemo(() => {
    const profile = overview?.user;
    if (!profile) return "Profile";
    return (
      profile.username ||
      [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
      "Member"
    );
  }, [overview]);

  const usernameTag = overview?.user?.username ? `@${overview.user.username}` : "";
  const memberSince = overview?.user?.date_joined
    ? new Date(overview.user.date_joined).toLocaleDateString()
    : null;
  const isSelf = overview?.relationship?.is_self ?? false;

  const posts = overview?.recent_posts ?? [];
  const photos = overview?.stats?.photos ?? [];
  const postCount = overview?.stats?.post_count;
  const friendCount = overview?.stats?.friend_count;
  const canViewPosts = overview?.can_view_posts ?? false;
  const canViewFriendCount = overview?.can_view_friend_count ?? false;
  const relationship = overview?.relationship;

  const stats = [
    {
      label: "Posts",
      value: canViewPosts && postCount !== null && postCount !== undefined ? postCount : canViewPosts ? 0 : "Private",
    },
    {
      label: "Friends",
      value:
        canViewFriendCount && friendCount !== null && friendCount !== undefined
          ? friendCount
          : canViewFriendCount
          ? 0
          : "Private",
    },
  ];

  const withAction = async (action: PendingAction, fn: () => Promise<void>) => {
    setPendingAction(action);
    try {
      await fn();
      await fetchOverview();
    } catch (err: any) {
      const message =
        err instanceof ApiError ? err.message : err?.message || "Something went wrong. Please try again.";
      toast.show(message, "error");
    } finally {
      setPendingAction(null);
    }
  };

  const handleSendFriendRequest = () => {
    if (!profileId) return;
    void withAction("friend", async () => {
      await apiPost(
        "/auth/friend-requests/",
        { to_user_id: profileId },
        { token: accessToken, cache: "no-store" }
      );
      toast.show("Friend request sent.");
    });
  };

  const handleCancelRequest = () => {
    if (!relationship?.outgoing_request_id) return;
    void withAction("cancel", async () => {
      await apiPost(
        `/auth/friend-requests/${relationship.outgoing_request_id}/cancel/`,
        undefined,
        { token: accessToken, cache: "no-store" }
      );
      toast.show("Friend request cancelled.");
    });
  };

  const handleAcceptRequest = () => {
    if (!relationship?.incoming_request_id) return;
    void withAction("accept", async () => {
      await apiPost(
        `/auth/friend-requests/${relationship.incoming_request_id}/accept-friend-request/`,
        undefined,
        { token: accessToken, cache: "no-store" }
      );
      toast.show("You are now friends.");
    });
  };

  const handleDeclineRequest = () => {
    if (!relationship?.incoming_request_id) return;
    void withAction("decline", async () => {
      await apiPost(
        `/auth/friend-requests/${relationship.incoming_request_id}/decline/`,
        undefined,
        { token: accessToken, cache: "no-store" }
      );
      toast.show("Friend request declined.");
    });
  };

  const handleUnfriend = () => {
    if (!relationship?.friend_entry_id) return;
    const userName = overview?.user?.username || overview?.user?.first_name || "this user";
    setConfirmDialog({
      isOpen: true,
      title: "Unfriend User",
      message: `Are you sure you want to unfriend ${userName}? You will no longer see each other's posts.`,
      confirmText: "Unfriend",
      confirmVariant: "danger",
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        void withAction("unfriend", async () => {
          await apiDelete(`/auth/friends/${relationship.friend_entry_id}/`, {
            token: accessToken,
            cache: "no-store",
          });
          toast.show("Friend removed.");
        });
      },
    });
  };

  const handleBlock = () => {
    if (!profileId) return;
    const userName = overview?.user?.username || overview?.user?.first_name || "this user";
    setConfirmDialog({
      isOpen: true,
      title: "Block User",
      message: `Are you sure you want to block ${userName}? You won't be able to see their posts or interact with them.`,
      confirmText: "Block",
      confirmVariant: "danger",
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        void withAction("block", async () => {
          await apiPost(
            "/auth/blocks/",
            { blocked_user: profileId },
            { token: accessToken, cache: "no-store" }
          );
          toast.show("User blocked.");
        });
      },
    });
  };

  const handleUnblock = () => {
    if (!relationship?.viewer_block_id) return;
    const userName = overview?.user?.username || overview?.user?.first_name || "this user";
    setConfirmDialog({
      isOpen: true,
      title: "Unblock User",
      message: `Are you sure you want to unblock ${userName}? You'll be able to see their posts again.`,
      confirmText: "Unblock",
      confirmVariant: "default",
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        void withAction("unblock", async () => {
          await apiDelete(`/auth/blocks/${relationship.viewer_block_id}/`, {
            token: accessToken,
            cache: "no-store",
          });
          toast.show("User unblocked.");
        });
      },
    });
  };

  const renderPrimaryActions = () => {
    if (!relationship || isSelf) {
      return (
        <Link
          href="/app/settings"
          className="inline-flex items-center justify-center gap-2 rounded-full btn-primary px-5 py-2 text-sm font-semibold text-white shadow-metallic transition hover:opacity-90"
        >
          Manage profile
        </Link>
      );
    }

    if (relationship.blocked_by_target) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-500">
          You have been blocked
        </span>
      );
    }

    if (relationship.viewer_has_blocked) {
      return (
        <button
          onClick={handleUnblock}
          disabled={pendingAction !== null}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction === "unblock" ? "Unblocking..." : "Unblock"}
        </button>
      );
    }

    if (relationship.is_friend) {
      return null;
    }

    if (relationship.incoming_request) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAcceptRequest}
            disabled={pendingAction !== null}
            className="inline-flex items-center justify-center gap-2 rounded-full btn-primary px-5 py-2 text-sm font-semibold text-white shadow-metallic transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "accept" ? "Accepting..." : "Accept request"}
          </button>
          <button
            onClick={handleDeclineRequest}
            disabled={pendingAction !== null}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "decline" ? "Declining..." : "Decline"}
          </button>
        </div>
      );
    }

    if (relationship.outgoing_request) {
      return (
        <button
          onClick={handleCancelRequest}
          disabled={pendingAction !== null}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction === "cancel" ? "Cancelling..." : "Cancel request"}
        </button>
      );
    }

    if (relationship.can_send_friend_request) {
      return (
        <button
          onClick={handleSendFriendRequest}
          disabled={pendingAction !== null}
          className="inline-flex items-center justify-center gap-2 rounded-full btn-primary px-5 py-2 text-sm font-semibold text-white shadow-metallic transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction === "friend" ? "Sending..." : "Add friend"}
        </button>
      );
    }

    return null;
  };

  const renderSecondaryActions = () => {
    if (!relationship || isSelf || relationship.blocked_by_target || relationship.viewer_has_blocked) {
      return null;
    }
    return (
      <button
        onClick={relationship.viewer_has_blocked ? handleUnblock : handleBlock}
        disabled={pendingAction !== null}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {relationship.viewer_has_blocked
          ? pendingAction === "unblock"
            ? "Unblocking..."
            : "Unblock"
          : pendingAction === "block"
          ? "Blocking..."
          : "Block"}
      </button>
    );
  };

  const renderPost = (post: Post) => {
    const authorLabel =
      post.author.username ||
      [post.author.first_name, post.author.last_name].filter(Boolean).join(" ") ||
      "Member";
    const createdAt = new Date(post.created_at).toLocaleString();
    const mediaUrls = Array.isArray(post.media) ? post.media.filter(Boolean) : [];
    return (
      <article
        key={post.id}
        className="rounded-[18px] border border-gray-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm"
      >
        <header className="mb-3 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gray-100">
            {post.author.profile_image_url ? (
              <Image
                src={post.author.profile_image_url}
                alt={authorLabel}
                width={44}
                height={44}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-gray-600">
                {(authorLabel || "U")[0]?.toUpperCase() || "U"}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{authorLabel}</p>
            <p className="text-xs text-gray-500">{createdAt}</p>
          </div>
        </header>
        <p className="whitespace-pre-line text-sm text-gray-800">{post.content}</p>
        {mediaUrls.length > 0 && (
          <div
            className={[
              "mt-4 grid gap-2",
              mediaUrls.length === 1 ? "grid-cols-1" : mediaUrls.length === 2 ? "grid-cols-2" : "grid-cols-3",
            ].join(" ")}
          >
            {mediaUrls.slice(0, 9).map((url, index) => (
              <Image
                key={`${post.id}-media-${index}`}
                src={url}
                alt={`Post media ${index + 1}`}
                width={320}
                height={240}
                className="h-full w-full rounded-lg border border-gray-200 object-cover"
              />
            ))}
          </div>
        )}
        <div className="mt-4">
          <Link
            href={`/app/feed/${post.id}`}
            className="text-sm font-semibold text-(--color-deep-navy) transition hover:opacity-80"
          >
            View full post
          </Link>
        </div>
      </article>
    );
  };

  return (
    <RequireAuth>
      <section className="min-h-screen bg-(--color-background) pb-16 pt-24 sm:pt-28">
  <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <Link
            href="/app/feed"
            className="inline-flex items-center gap-2 text-sm font-semibold text-(--color-deep-navy) transition hover:opacity-80"
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

          <div className="mt-6 rounded-2xl border border-gray-100 bg-white/95 p-6 shadow-metallic backdrop-blur-md sm:p-8">
            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            ) : error ? (
              <div className="text-center text-sm text-gray-600">
                <p>{error}</p>
                <p className="mt-3 text-xs text-gray-400">
                  Profile ID: {profileId ?? (normalizedRawId || "Unknown")}
                </p>
              </div>
            ) : !overview ? (
              <div className="text-center text-sm text-gray-600">
                <p>Profile unavailable.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-5">
                      {isSelf ? (
                        <button
                          type="button"
                          onClick={() => setProfileImageModalOpen(true)}
                          className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-(--color-deep-navy)/30 bg-gray-100 sm:h-28 sm:w-28"
                        >
                          {overview.user.profile_image_url ? (
                            <Image
                              src={overview.user.profile_image_url}
                              alt={displayName}
                              fill
                              sizes="112px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-gray-500">
                              {(displayName || "U").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-(--color-deep-navy)/30 bg-gray-100 sm:h-28 sm:w-28">
                          {overview.user.profile_image_url ? (
                            <Image
                              src={overview.user.profile_image_url}
                              alt={displayName}
                              fill
                              sizes="112px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-gray-500">
                              {(displayName || "U").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}
                    <div>
                      <h1 className="text-2xl font-bold text-(--color-deep-navy) sm:text-3xl">{displayName}</h1>
                      {usernameTag && <p className="text-sm text-gray-500">{usernameTag}</p>}
                      {memberSince && (
                        <p className="mt-2 text-xs text-gray-400">Member since {memberSince}</p>
                      )}
                      {overview.user.bio && (
                        <p className="mt-4 max-w-xl text-sm text-gray-600 whitespace-pre-line">
                          {overview.user.bio}
                        </p>
                      )}
                    </div>
                  </div>
                    <div className="flex flex-col items-start gap-3 sm:items-end">
                    <div className="flex items-center gap-2">
                      {renderPrimaryActions()}
                      {!isSelf && overview && (
                        <UserActionsMenu
                          overview={overview}
                          accessToken={accessToken}
                          onUpdated={fetchOverview}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex flex-wrap items-center gap-2">
                    {(["overview", "photos", "posts"] as ProfileTab[]).map((tab) => {
                      const disabled =
                        (tab === "photos" || tab === "posts") && !canViewPosts;
                      const label =
                        tab === "overview" ? "Overview" : tab === "photos" ? "Photos" : "Posts";
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => !disabled && setActiveTab(tab)}
                          disabled={disabled}
                          className={[
                            "rounded-full px-4 py-2 text-sm font-semibold transition",
                            activeTab === tab
                              ? "btn-primary text-white shadow"
                              : "border border-gray-300 text-gray-600 hover:bg-gray-100",
                            disabled ? "cursor-not-allowed opacity-50" : "",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeTab === "overview" && (
                  <div className="mt-6 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {stats.map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-xl border border-gray-100 bg-white/95 p-4 text-center shadow-metallic"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {stat.label}
                          </p>
                          <p className="mt-2 text-2xl font-bold text-(--color-deep-navy)">
                            {stat.value ?? "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                    {!canViewFriendCount && (
                      <p className="text-xs text-gray-400">
                        Friend count is private for this profile.
                      </p>
                    )}
                    {!canViewPosts && (
                      <p className="text-xs text-gray-400">
                        Posts and photos are private. Send a friend request to see more.
                      </p>
                    )}
                  </div>
                )}

                {activeTab === "photos" && (
                  <section className="mt-6">
                    {canViewPosts ? (
                      photos.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-(--color-deep-navy)">Photos</h2>
                              <Link
                                href="/app/feed"
                                className="text-sm font-semibold text-(--color-deep-navy) transition hover:opacity-80"
                              >
                                See feed
                              </Link>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            {photos.map((url, index) => (
                              <Image
                                key={`photo-${index}`}
                                src={url}
                                alt={`Photo ${index + 1}`}
                                width={320}
                                height={320}
                                className="h-40 w-full rounded-xl border border-gray-200 object-cover"
                              />
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">No photos yet.</p>
                      )
                    ) : (
                      <p className="text-sm text-gray-500">
                        Photos are private. Send a friend request to see more from {displayName}.
                      </p>
                    )}
                  </section>
                )}

                {activeTab === "posts" && (
                  <section className="mt-6 space-y-4">
                    {canViewPosts ? (
                      posts.length === 0 ? (
                        <p className="text-sm text-gray-500">No posts to show yet.</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-(--color-deep-navy)">Recent posts</h2>
                            <Link
                              href="/app/feed"
                              className="text-sm font-semibold text-(--color-deep-navy) transition hover:opacity-80"
                            >
                              See feed
                            </Link>
                          </div>
                          <div className="space-y-4">{posts.map(renderPost)}</div>
                        </>
                      )
                    ) : (
                      <p className="text-sm text-gray-500">
                        Posts are private. Send a friend request to see more from {displayName}.
                      </p>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
          </div>
        </section>
        <ConfirmationDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          cancelText="Cancel"
          confirmVariant={confirmDialog.confirmVariant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        />

      <ProfileImageModal
        open={profileImageModalOpen}
        onClose={() => setProfileImageModalOpen(false)}
        currentImageUrl={overview?.user?.profile_image_url}
        userId={overview?.user?.id}
      />
      </RequireAuth>
    );
  }
