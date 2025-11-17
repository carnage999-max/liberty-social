"use client";

import { useRef, useEffect, useState } from "react";
import type { ReactionType } from "@/lib/types";
import { AdvancedEmojiPicker } from "./AdvancedEmojiPicker";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";

const REACTION_TYPES: ReactionType[] = ["like", "love", "haha", "sad", "angry"];

const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  sad: "😢",
  angry: "😠",
};

const REACTION_LABELS: Record<ReactionType, string> = {
  like: "Like",
  love: "Love",
  haha: "Haha",
  sad: "Sad",
  angry: "Angry",
};

interface ReactionPickerProps {
  onSelect: (reactionEmoji: string) => void;
  onClose: () => void;
  currentReaction?: string | null;
}

interface ReactionPreferences {
  favorite_emojis: string[];
  recent_emojis: string[];
}

export function ReactionPicker({ onSelect, onClose, currentReaction }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const { accessToken } = useAuth();
  const [showAdvancedPicker, setShowAdvancedPicker] = useState(false);
  const [preferences, setPreferences] = useState<ReactionPreferences | null>(null);
  const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(null);

  // Load user's emoji preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!accessToken) return;
      try {
        const data = await apiGet<ReactionPreferences>(
          "/reaction-preferences/me/",
          { token: accessToken }
        );
        setPreferences(data);
      } catch (err) {
        console.error("Failed to load reaction preferences:", err);
      }
    };

    loadPreferences();
  }, [accessToken]);

  // Track recent emoji usage
  const handleEmojiSelect = async (emoji: string) => {
    if (!accessToken) {
      onSelect(emoji);
      return;
    }

    try {
      // Add to recent emojis
      const response = await apiPost(
        "/reaction-preferences/add_recent/",
        { emoji },
        { token: accessToken }
      );
      setPreferences(response);
      onSelect(emoji);
    } catch (err) {
      console.error("Failed to track emoji usage:", err);
      onSelect(emoji);
    }
  };

  const handleToggleFavorite = async (emoji: string) => {
    if (!accessToken) return;
    try {
      const response = await apiPost(
        "/reaction-preferences/toggle_favorite/",
        { emoji },
        { token: accessToken }
      );
      setPreferences(response);
    } catch (err) {
      console.error("Failed to toggle favorite emoji:", err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
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
  }, [onClose]);

  const handleReactionClick = (e: React.MouseEvent, reactionType: ReactionType) => {
    e.stopPropagation();
    e.preventDefault();
    handleEmojiSelect(REACTION_EMOJIS[reactionType]);
  };

  if (showAdvancedPicker) {
    return (
      <AdvancedEmojiPicker
        onSelect={handleEmojiSelect}
        onClose={() => setShowAdvancedPicker(false)}
        recentEmojis={preferences?.recent_emojis || []}
        favoriteEmojis={preferences?.favorite_emojis || []}
        onToggleFavorite={handleToggleFavorite}
        currentReaction={currentReaction}
      />
    );
  }

  return (
    <div
      ref={pickerRef}
      className="relative flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-xl"
      role="menu"
      aria-label="Reaction picker"
      style={{ animation: "fadeIn 0.15s ease-out" }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {REACTION_TYPES.map((reactionType) => {
        const emoji = REACTION_EMOJIS[reactionType];
        const isSelected = emoji === currentReaction;
        const isHovered = hoveredReaction === reactionType;

        return (
          <button
            key={reactionType}
            type="button"
            onClick={(e) => handleReactionClick(e, reactionType)}
            onMouseEnter={() => setHoveredReaction(reactionType)}
            onMouseLeave={() => setHoveredReaction(null)}
            className={`
              relative flex h-10 w-10 items-center justify-center rounded-full
              text-2xl transition-all duration-150
              ${isSelected || isHovered ? "scale-125" : "scale-100"}
              ${isSelected ? "bg-gray-100" : "hover:bg-gray-50"}
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40
            `}
            aria-label={REACTION_LABELS[reactionType]}
            title={REACTION_LABELS[reactionType]}
          >
            <span className="select-none text-2xl">{emoji}</span>
            {isHovered && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
                {REACTION_LABELS[reactionType]}
              </span>
            )}
          </button>
        );
      })}

      {/* Expand button for more emojis */}
      <div className="border-l border-gray-200 pl-1 ml-1">
        <button
          type="button"
          onClick={() => setShowAdvancedPicker(true)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-xl transition-all duration-150 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          aria-label="Browse all emojis"
          title="Browse all emojis"
        >
          <span className="select-none">+</span>
        </button>
      </div>
    </div>
  );
}

