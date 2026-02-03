"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useToast } from "@/components/Toast";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import type { UserFilterPreference, UserFilterProfile, UserProfileOverview } from "@/lib/types";

interface UserActionsMenuProps {
  overview: UserProfileOverview;
  accessToken?: string | null;
  onUpdated?: () => void;
}

export function UserActionsMenu({ overview, accessToken, onUpdated }: UserActionsMenuProps) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showMuteConfirm, setShowMuteConfirm] = useState(false);
  const [showUnmuteConfirm, setShowUnmuteConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const relationship = overview.relationship;
  const isSelf = relationship?.is_self ?? false;

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

  useEffect(() => {
    if (!accessToken || !overview.user.id) return;
    const loadMuteStatus = async () => {
      try {
        const pref = await apiGet<UserFilterPreference>("/moderation/filter-preferences/", {
          token: accessToken,
          cache: "no-store",
        });
        const profileId = pref?.active_profile?.id;
        if (!profileId) return;
        const profile = await apiGet<UserFilterProfile>(`/moderation/filter-profiles/${profileId}/`, {
          token: accessToken,
          cache: "no-store",
        });
        const muted = (profile.account_mutes || []).includes(overview.user.id);
        setIsMuted(muted);
      } catch (err) {
        console.error(err);
      }
    };
    void loadMuteStatus();
  }, [accessToken, overview.user.id]);

  const handleUnfriend = useCallback(async () => {
    if (!accessToken || !relationship?.friend_entry_id) return;
    setPending(true);
    try {
      await apiDelete(`/auth/friends/${relationship.friend_entry_id}/`, {
        token: accessToken,
        cache: "no-store",
      });
      toast.show("Friend removed.");
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.show("Unable to unfriend right now.", "error");
    } finally {
      setPending(false);
      setMenuOpen(false);
      setShowUnfriendConfirm(false);
    }
  }, [accessToken, relationship?.friend_entry_id, toast, onUpdated]);

  const handleBlock = useCallback(async () => {
    if (!accessToken || !overview.user.id) return;
    setPending(true);
    try {
      await apiPost(
        "/auth/blocks/",
        { blocked_user: overview.user.id },
        { token: accessToken, cache: "no-store" }
      );
      toast.show("User blocked.");
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.show("Unable to block right now.", "error");
    } finally {
      setPending(false);
      setMenuOpen(false);
      setShowBlockConfirm(false);
    }
  }, [accessToken, overview.user.id, toast, onUpdated]);

  const updateMute = useCallback(
    async (nextMuted: boolean) => {
      if (!accessToken || !overview.user.id) return;
      setPending(true);
      try {
        const pref = await apiGet<UserFilterPreference>("/moderation/filter-preferences/", {
          token: accessToken,
          cache: "no-store",
        });
        const profileId = pref?.active_profile?.id;
        if (!profileId) throw new Error("No active filter profile.");
        const profile = await apiGet<UserFilterProfile>(`/moderation/filter-profiles/${profileId}/`, {
          token: accessToken,
          cache: "no-store",
        });
        const current = profile.account_mutes || [];
        const next = nextMuted
          ? Array.from(new Set([...current, overview.user.id]))
          : current.filter((id) => id !== overview.user.id);
        await apiPatch(`/moderation/filter-profiles/${profileId}/`, { account_mutes: next }, { token: accessToken });
        setIsMuted(nextMuted);
        toast.show(nextMuted ? "User muted." : "User unmuted.");
        onUpdated?.();
      } catch (err) {
        console.error(err);
        toast.show("Unable to update mute status.", "error");
      } finally {
        setPending(false);
        setMenuOpen(false);
        setShowMuteConfirm(false);
        setShowUnmuteConfirm(false);
      }
    },
    [accessToken, overview.user.id, toast, onUpdated]
  );

  if (isSelf || relationship?.blocked_by_target || relationship?.viewer_has_blocked) {
    return null;
  }

  const userName = overview.user.username || overview.user.first_name || "this user";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
      >
        <span className="sr-only">Open user actions</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 13a1 1 0 100-2 1 1 0 000 2zm0-7a1 1 0 100-2 1 1 0 000 2zm0 14a1 1 0 100-2 1 1 0 000 2z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {relationship?.is_friend && (
            <button
              type="button"
              onClick={() => setShowUnfriendConfirm(true)}
              disabled={pending}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Unfriend
            </button>
          )}
          <button
            type="button"
            onClick={() => (isMuted ? setShowUnmuteConfirm(true) : setShowMuteConfirm(true))}
            disabled={pending}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isMuted ? "Unmute user" : "Mute user"}
          </button>
          <button
            type="button"
            onClick={() => setShowBlockConfirm(true)}
            disabled={pending}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Block user
          </button>
        </div>
      )}

      <ConfirmationDialog
        isOpen={showUnfriendConfirm}
        title="Unfriend User"
        message={`Are you sure you want to unfriend ${userName}? You will no longer see each other's posts.`}
        confirmText="Unfriend"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleUnfriend}
        onCancel={() => setShowUnfriendConfirm(false)}
      />

      <ConfirmationDialog
        isOpen={showBlockConfirm}
        title="Block User"
        message={`Are you sure you want to block ${userName}? You won't be able to see their posts or interact with them.`}
        confirmText="Block"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleBlock}
        onCancel={() => setShowBlockConfirm(false)}
      />

      <ConfirmationDialog
        isOpen={showMuteConfirm}
        title="Mute User"
        message={`Mute ${userName}? Their posts will be hidden from your feed.`}
        confirmText="Mute"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={() => updateMute(true)}
        onCancel={() => setShowMuteConfirm(false)}
      />

      <ConfirmationDialog
        isOpen={showUnmuteConfirm}
        title="Unmute User"
        message={`Unmute ${userName}? Their posts may appear in your feed again.`}
        confirmText="Unmute"
        cancelText="Cancel"
        confirmVariant="default"
        onConfirm={() => updateMute(false)}
        onCancel={() => setShowUnmuteConfirm(false)}
      />
    </div>
  );
}
