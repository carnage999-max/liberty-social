"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import type { Friend, FriendRequest, Post } from "@/lib/types";
import Image from "next/image";
import ProfileImageModal from "./ProfileImageModal";

type ProfileCardProps = {
  showStats?: boolean;
  className?: string;
  profileHref?: string;
};

import { useRouter } from "next/navigation";

export default function ProfileCard({ showStats = true, className = "", profileHref }: ProfileCardProps = {}) {
  const { user, rawUser, accessToken, refreshUser } = useAuth();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

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

  const handleCardClick = (e: React.MouseEvent) => {
    if (!profileHref) return;
    const target = e.target as HTMLElement | null;
    // don't navigate if an interactive element was the target
    if (!target) return;
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;
    void router.push(profileHref);
  };

  return (
    <div
      onClick={handleCardClick}
      className={[
        `flex flex-col items-center ${profileHref ? "cursor-pointer" : ""} rounded-[16px] bg-white/80 p-4 text-center shadow-md backdrop-blur-sm sm:p-6`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        onClick={() => (profileHref ? router.push(profileHref) : setModalOpen(true))}
        className="relative mb-3 rounded-full border-2 border-(--color-deep-navy) p-1 focus:outline-none focus:ring focus:ring-offset-2 focus:ring-(--color-deep-navy)/40"
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

      <ProfileImageModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        currentImageUrl={avatarSrc}
        userId={resolvedUser.id}
      />
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
