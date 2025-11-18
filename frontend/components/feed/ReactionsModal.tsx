"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { Reaction } from "@/lib/types";

interface ReactionsModalProps {
  reactions: Reaction[];
  isOpen: boolean;
  onClose: () => void;
  postOrCommentTitle?: string;
}

// Map old text reaction types to emojis for backward compatibility
const REACTION_TYPE_TO_EMOJI: Record<string, string> = {
  "like": "👍",
  "love": "❤️",
  "haha": "😂",
  "sad": "😢",
  "angry": "😠",
};

// Convert reaction type to emoji
function getReactionEmoji(reactionType: string): string {
  if (REACTION_TYPE_TO_EMOJI[reactionType]) {
    return REACTION_TYPE_TO_EMOJI[reactionType];
  }
  return reactionType;
}

export function ReactionsModal({
  reactions,
  isOpen,
  onClose,
  postOrCommentTitle = "Post",
}: ReactionsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) {
    return null;
  }

  // Group reactions by user
  const reactionsByUser = reactions.reduce(
    (acc, reaction) => {
      const userId = reaction.user?.id;
      if (!userId) return acc;

      if (!acc[userId]) {
        acc[userId] = {
          user: reaction.user,
          reactions: [],
        };
      }
      acc[userId].reactions.push(reaction.reaction_type);
      return acc;
    },
    {} as Record<
      string,
      {
        user: (typeof reactions[0])["user"];
        reactions: string[];
      }
    >
  );

  const userReactions = Object.values(reactionsByUser).sort((a, b) => {
    // Sort by number of reactions (descending), then by user name
    if (b.reactions.length !== a.reactions.length) {
      return b.reactions.length - a.reactions.length;
    }
    return (a.user?.first_name || "").localeCompare(b.user?.first_name || "");
  });

  const modalContent = (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white rounded-t-2xl">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reactions</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {userReactions.length} {userReactions.length === 1 ? "person" : "people"} reacted
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
          aria-label="Close"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto bg-white">
        {userReactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No reactions yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {userReactions.map((item, index) => (
              <div
                key={`${item.user?.id}-${index}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition"
              >
                {/* User Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {item.user?.profile_image_url ? (
                    <img
                      src={item.user.profile_image_url}
                      alt={item.user.first_name || "User"}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold">
                      {(item.user?.first_name?.[0] || "U").toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.user?.first_name} {item.user?.last_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      @{item.user?.username || "user"}
                    </p>
                  </div>
                </div>

                {/* Reactions */}
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  {item.reactions.map((reactionType, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-center bg-gray-100 rounded-full w-8 h-8 text-sm hover:bg-gray-200 transition"
                      title={reactionType}
                    >
                      {getReactionEmoji(reactionType)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl text-center">
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          Close
        </button>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-xl border border-gray-200 max-h-96 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {modalContent}
      </div>
    </div>,
    document.body
  );
}
