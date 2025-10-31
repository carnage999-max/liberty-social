"use client";

import { useAuth } from "@/lib/auth-context";
import Image from "next/image";

export default function ProfileCard() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="bg-white/80 backdrop-blur-sm shadow-md rounded-[16px] p-4 sm:p-6 flex flex-col items-center text-center">
      <Image
        src={user.profile_image_url || "/images/default-avatar.png"}
        alt={user.username || "Profile picture"}
        width={80}
        height={80}
        className="rounded-full object-cover mb-3 border-2 border-[var(--color-primary)]"
      />
      <h3 className="font-semibold text-lg text-gray-800">
        {user.username || `${user.first_name} ${user.last_name}`}
      </h3>
      <p className="text-sm text-gray-500">{user.email}</p>

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
