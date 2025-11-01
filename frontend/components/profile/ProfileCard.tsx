"use client";

import { useAuth } from "@/lib/auth-context";
import Image from "next/image";

export default function ProfileCard() {
  const { user } = useAuth();

  if (!user) return null;

  const displayName =
    (user.username ?? "").trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    (user.email ? user.email.split("@")[0] ?? "" : "") ||
    "Liberty Social member";
  const subtitle = user.email || user.username || "";
  const avatarSrc = user.profile_image_url || "/images/default-avatar.png";
  const avatarAlt = `${displayName}'s avatar`;

  return (
    <div className="bg-white/80 backdrop-blur-sm shadow-md rounded-[16px] p-4 sm:p-6 flex flex-col items-center text-center">
      <Image
        src={avatarSrc}
        alt={avatarAlt}
        width={80}
        height={80}
        className="rounded-full object-cover mb-3 border-2 border-[var(--color-primary)]"
      />
      <h3 className="font-semibold text-lg text-gray-800">
        {displayName}
      </h3>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}

      <div className="mt-4 w-full flex justify-around text-sm text-gray-600">
        <span>
          <strong>12</strong> Friends
        </span>
        <span>
          <strong>5</strong> Posts
        </span>
        <span>
          <strong>3</strong> Communities
        </span>
      </div>
    </div>
  );
}
