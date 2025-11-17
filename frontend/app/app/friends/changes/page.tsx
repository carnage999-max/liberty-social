"use client";

import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";
import type { User } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";

interface FriendshipChange {
  id: number;
  friend: User;
  action: string;
  action_display: string;
  removal_reason?: string;
  removal_reason_display?: string;
  created_at: string;
}

export default function FriendChangesPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const toast = useToast();
  
  const [newFriends, setNewFriends] = useState<FriendshipChange[]>([]);
  const [formerFriends, setFormerFriends] = useState<FriendshipChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFriendChanges = async () => {
      if (!accessToken) return;
      try {
        setLoading(true);
        setError(null);
        
        const [newFriendsData, formerFriendsData] = await Promise.all([
          apiGet<FriendshipChange[] | { results: FriendshipChange[] }>("/auth/friendship-history/new_friends/", {
            token: accessToken,
            cache: "no-store",
          }),
          apiGet<FriendshipChange[] | { results: FriendshipChange[] }>("/auth/friendship-history/former_friends/", {
            token: accessToken,
            cache: "no-store",
          }),
        ]);
        
        setNewFriends(Array.isArray(newFriendsData) ? newFriendsData : (newFriendsData as { results: FriendshipChange[] })?.results || []);
        setFormerFriends(Array.isArray(formerFriendsData) ? formerFriendsData : (formerFriendsData as { results: FriendshipChange[] })?.results || []);
      } catch (err) {
        console.error(err);
        setError("Unable to load friend changes. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchFriendChanges();
  }, [accessToken]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric", 
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined 
      });
    }
  };

  const getRemovalReasonBadgeColor = (removalReason?: string) => {
    switch (removalReason) {
      case "unfriended_by_user":
        return "bg-blue-50 text-blue-700 border border-blue-200";
      case "unfriended_by_friend":
        return "bg-red-50 text-red-700 border border-red-200";
      case "both_mutual":
        return "bg-gray-50 text-gray-700 border border-gray-200";
      default:
        return "bg-gray-50 text-gray-700 border border-gray-200";
    }
  };

  const getRemovalReasonText = (removalReason?: string) => {
    switch (removalReason) {
      case "unfriended_by_user":
        return "You unfriended";
      case "unfriended_by_friend":
        return "They unfriended you";
      case "both_mutual":
        return "Mutual unfriend";
      default:
        return "Unfriended";
    }
  };

  const FriendChangeCard = ({ change, isNew }: { change: FriendshipChange; isNew: boolean }) => {
    const friend = change.friend;
    const displayName =
      friend.username ||
      [friend.first_name, friend.last_name].filter(Boolean).join(" ") ||
      friend.email;

    return (
      <div className="flex items-center justify-between gap-4 rounded-[16px] border border-gray-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
            {friend.profile_image_url ? (
              <Image
                src={friend.profile_image_url}
                alt={displayName}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-base font-semibold text-gray-600">
                {(displayName || "U")[0]?.toUpperCase() || "U"}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            <p className="text-xs text-gray-500">
              {isNew ? "Added" : "Removed"} {formatDate(change.created_at)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isNew && change.removal_reason && (
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getRemovalReasonBadgeColor(change.removal_reason)}`}>
              {getRemovalReasonText(change.removal_reason)}
            </span>
          )}
          {friend.id && friend.id !== "undefined" ? (
            <Link
              href={`/app/users/${friend.id}`}
              className="rounded-lg border border-(--color-deep-navy) px-3 py-1.5 text-xs font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white"
            >
              View profile
            </Link>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-gray-300">Friend Changes</h1>
        <p className="text-sm text-gray-500">
          Track changes to your friend list over the last 30 days
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white/90 p-8 text-center shadow-sm">
          <p className="text-sm text-gray-700">{error}</p>
        </div>
      ) : newFriends.length === 0 && formerFriends.length === 0 ? (
        <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">
            No friend changes in the last 30 days
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Come back here when you make new friends or unfriend someone.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {newFriends.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-green-500"></div>
                <h2 className="text-lg font-semibold text-(--color-silver-mid)">
                  New Friends ({newFriends.length})
                </h2>
              </div>
              <ul className="space-y-3">
                {newFriends.map((change) => (
                  <li key={change.id}>
                    <FriendChangeCard change={change} isNew={true} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {formerFriends.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-red-500"></div>
                <h2 className="text-lg font-semibold text-(--color-silver-mid)">
                  Former Friends ({formerFriends.length})
                </h2>
              </div>
              <ul className="space-y-3">
                {formerFriends.map((change) => (
                  <li key={change.id}>
                    <FriendChangeCard change={change} isNew={false} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
