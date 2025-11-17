"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { EMOJI_CATEGORIES, COMMON_REACTION_EMOJIS } from "@/lib/emoji-data";

interface AdvancedEmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  recentEmojis?: string[];
  favoriteEmojis?: string[];
  onToggleFavorite?: (emoji: string) => void;
  currentReaction?: string | null;
}

export function AdvancedEmojiPicker({
  onSelect,
  onClose,
  recentEmojis = [],
  favoriteEmojis = [],
  onToggleFavorite,
  currentReaction,
}: AdvancedEmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"recent" | "favorite" | "all" | "search" | number>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure component mounts on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Search through emojis
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: string[] = [];
    
    for (const category of EMOJI_CATEGORIES) {
      for (const emoji of category.emojis) {
        // Simple search - in a real app you'd have emoji names/keywords
        if (results.length < 50) {
          results.push(emoji);
        }
      }
    }
    return results;
  }, [searchQuery]);

  // Get all emojis flattened
  const allEmojis = useMemo(() => {
    return EMOJI_CATEGORIES.flatMap((category) => category.emojis);
  }, []);

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

  const handleEmojiClick = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  const handleToggleFavorite = (e: React.MouseEvent, emoji: string) => {
    e.stopPropagation();
    onToggleFavorite?.(emoji);
  };

  const EmojiGrid = ({ emojis }: { emojis: string[] }) => (
    <div className="grid grid-cols-8 gap-1 p-3">
      {emojis.map((emoji) => {
        const isFavorite = favoriteEmojis.includes(emoji);
        const isSelected = emoji === currentReaction;

        return (
          <div key={emoji} className="relative">
            <button
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              onMouseEnter={() => setHoveredEmoji(emoji)}
              onMouseLeave={() => setHoveredEmoji(null)}
              className={`
                h-10 w-10 flex items-center justify-center rounded-lg text-xl
                transition-all duration-150
                ${isSelected ? "bg-gray-200 ring-2 ring-blue-500" : "hover:bg-gray-100"}
                focus:outline-none focus:ring-2 focus:ring-blue-400
              `}
              title={emoji}
            >
              {emoji}
            </button>
            
            {/* Favorite indicator */}
            {isFavorite && (
              <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full w-4 h-4 flex items-center justify-center">
                <span className="text-xs">⭐</span>
              </div>
            )}
            
            {/* Favorite toggle button on hover */}
            {hoveredEmoji === emoji && onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => handleToggleFavorite(e, emoji)}
                className="absolute -top-2 -right-2 bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <span className="text-xs">{isFavorite ? "★" : "☆"}</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const tabs = [
    { id: "recent" as const, label: "Recent", icon: "🕐" },
    { id: "favorite" as const, label: "Favorite", icon: "⭐" },
    { id: "all" as const, label: "All", icon: "✨" },
  ];

  if (!mounted) {
    return null;
  }

  const pickerContent = (
    <div
      ref={pickerRef}
      className="w-full"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setActiveTab("search");
          }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder-gray-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b border-gray-200 bg-gray-50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setSearchQuery("");
            }}
            className={`
              flex-1 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab.id
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
              }
            `}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area - max height with scroll */}
      <div className="max-h-80 overflow-y-auto">
        {/* Search Results */}
        {activeTab === "search" && searchQuery.trim() ? (
          <EmojiGrid emojis={searchResults} />
        ) : null}

        {/* Recent Emojis */}
        {activeTab === "recent" && recentEmojis.length > 0 ? (
          <EmojiGrid emojis={recentEmojis} />
        ) : activeTab === "recent" ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No recent emojis yet. Start reacting to see them here!
          </div>
        ) : null}

        {/* Favorite Emojis */}
        {activeTab === "favorite" && favoriteEmojis.length > 0 ? (
          <EmojiGrid emojis={favoriteEmojis} />
        ) : activeTab === "favorite" ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No favorite emojis yet. Star an emoji to add it here!
          </div>
        ) : null}

        {/* All Emojis */}
        {activeTab === "all" ? (
          <EmojiGrid emojis={allEmojis} />
        ) : null}

        {/* Category Tabs - Horizontal scroll */}
        {!searchQuery && activeTab !== "recent" && activeTab !== "favorite" && activeTab !== "all" ? (
          <>
            {/* Category Selector */}
            <div className="flex gap-1 p-2 border-b border-gray-200 bg-gray-50 overflow-x-auto">
              {EMOJI_CATEGORIES.map((category, idx) => (
                <button
                  key={category.name}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                    ${activeTab === idx
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                    }
                  `}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Category Emojis */}
            {typeof activeTab === "number" && EMOJI_CATEGORIES[activeTab] ? (
              <EmojiGrid emojis={EMOJI_CATEGORIES[activeTab].emojis} />
            ) : null}
          </>
        ) : null}
      </div>

      {/* Quick Reactions Bar */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2 justify-between">
          <span className="text-xs font-medium text-gray-600">Quick reactions:</span>
          <div className="flex gap-1">
            {COMMON_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="text-lg hover:scale-125 transition-transform"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-40 pointer-events-none" onClick={onClose}>
      <div
        ref={pickerRef}
        className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 w-96 pointer-events-auto"
        style={{
          animation: "fadeIn 0.15s ease-out",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {pickerContent}
      </div>
    </div>,
    document.body
  );
}
