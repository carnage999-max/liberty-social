"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import type { Friend, FriendRequest, Post } from "@/lib/types";
import Image from "next/image";
import { useToast } from "@/components/Toast";
import { API_BASE, apiPatch } from "@/lib/api";

type ProfileCardProps = {
  showStats?: boolean;
  className?: string;
};

export default function ProfileCard({ showStats = true, className = "" }: ProfileCardProps = {}) {
  const { user, rawUser, accessToken, refreshUser } = useAuth();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingImage, setUpdatingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedUser =
    user ??
    (rawUser && !Array.isArray(rawUser) ? rawUser : Array.isArray(rawUser) ? rawUser[0] ?? null : null);

  if (!resolvedUser) return null;

  const {
    count: friendsCount,
    loading: friendsLoading,
  } = usePaginatedResource<Friend>("/auth/friends/", {
    enabled: showStats && !!resolvedUser,
    query: { page_size: 1 },
  });

  const {
    count: postsCount,
    loading: postsLoading,
  } = usePaginatedResource<Post>("/posts/", {
    enabled: showStats && !!resolvedUser,
    query: { page_size: 1, mine: "1" },
  });

  const {
    count: incomingRequests,
    loading: requestsLoading,
  } = usePaginatedResource<FriendRequest>("/auth/friend-requests/", {
    enabled: showStats && !!resolvedUser,
    query: { direction: "incoming", page_size: 1 },
  });

  const displayName =
    (resolvedUser.username ?? "").trim() ||
    [resolvedUser.first_name, resolvedUser.last_name].filter(Boolean).join(" ").trim() ||
    (resolvedUser.email ? resolvedUser.email.split("@")[0] ?? "" : "") ||
    "Liberty Social member";
  const subtitle = resolvedUser.email || resolvedUser.username || "";
  const avatarSrc = resolvedUser.profile_image_url || "/images/default-avatar.png";
  const avatarAlt = `${displayName}'s avatar`;

  const closeModal = () => {
    setModalOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = () => {
    if (!accessToken) {
      toast.show("You need to be signed in to update your photo.", "error");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !accessToken) return;
    setUpdatingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/auth/profile/upload-picture/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Failed to upload profile image.");
      }
      await refreshUser();
      toast.show("Profile photo updated.");
      closeModal();
    } catch (err: any) {
      toast.show(err?.message || "Unable to update photo.", "error");
    } finally {
      setUpdatingImage(false);
    }
  };

  const handleRemove = async () => {
    if (!accessToken || !resolvedUser.id) return;
    setUpdatingImage(true);
    try {
      await apiPatch(`/auth/user/${resolvedUser.id}/`, { profile_image_url: null }, {
        token: accessToken,
        cache: "no-store",
      });
      await refreshUser();
      toast.show("Profile photo removed.");
      closeModal();
    } catch (err: any) {
      toast.show(err?.message || "Unable to remove photo.", "error");
    } finally {
      setUpdatingImage(false);
    }
  };

  return (
    <div
      className={[
        "flex flex-col items-center rounded-[16px] bg-white/80 p-4 text-center shadow-md backdrop-blur-sm sm:p-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="relative mb-3 rounded-full border-2 border-[var(--color-primary)] p-1 focus:outline-none focus:ring focus:ring-offset-2 focus:ring-[var(--color-primary)]/40"
        aria-label="View profile photo"
      >
        <Image
          src={avatarSrc}
          alt={avatarAlt}
          width={80}
          height={80}
          className="rounded-full object-cover"
        />
        <span className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition hover:bg-black/10" />
      </button>
      <h3 className="font-semibold text-lg text-gray-800">
        {displayName}
      </h3>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}

      {showStats && (
        <div className="mt-4 grid w-full grid-cols-3 text-center text-sm text-gray-600">
          <Stat label="Friends" value={friendsLoading ? "--" : friendsCount} />
          <Stat label="Posts" value={postsLoading ? "--" : postsCount} />
          <Stat label="Requests" value={requestsLoading ? "--" : incomingRequests} />
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Profile photo</h3>
                <p className="text-sm text-gray-500">Update or remove your profile image.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:text-gray-700"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M6 18L18 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center gap-4">
              <Image
                src={avatarSrc}
                alt={avatarAlt}
                width={160}
                height={160}
                className="rounded-full object-cover border-4 border-[var(--color-primary)]/30"
              />

              <div className="flex w-full flex-col gap-2">
                <button
                  type="button"
                  onClick={handleFileSelect}
                  disabled={updatingImage}
                  className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingImage ? "Updating..." : "Change photo"}
                </button>
                {resolvedUser.profile_image_url && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={updatingImage}
                    className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-base font-semibold text-[var(--color-primary)]">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  );
}
