"use client";

import { useRef, useEffect, useState } from "react";
import type { ReactionType } from "@/lib/types";

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
  onSelect: (reactionType: ReactionType) => void;
  onClose: () => void;
  currentReaction?: ReactionType | null;
}

export function ReactionPicker({ onSelect, onClose, currentReaction }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(null);

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
    if (reactionType === currentReaction) {
      // If clicking the same reaction, remove it
      onSelect(reactionType);
    } else {
      // Otherwise, set the new reaction
      onSelect(reactionType);
    }
    onClose();
  };

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 z-50 mb-2 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-xl"
      role="menu"
      aria-label="Reaction picker"
      style={{ animation: "fadeIn 0.15s ease-out" }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {REACTION_TYPES.map((reactionType) => {
        const isSelected = reactionType === currentReaction;
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
            <span className="select-none text-2xl">{REACTION_EMOJIS[reactionType]}</span>
            {isHovered && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
                {REACTION_LABELS[reactionType]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

