"use client";

import { useState } from "react";
import { useFeedPreferences } from "@/hooks/useFeedPreferences";

interface FeedFiltersProps {
  onFiltersChange?: (filters: {
    showFriendPosts: boolean;
    showPagePosts: boolean;
    selectedCategory?: string;
  }) => void;
}

export default function FeedFilters({ onFiltersChange }: FeedFiltersProps) {
  const { preferences, loading } = useFeedPreferences();
  const [showFriendPosts, setShowFriendPosts] = useState(true);
  const [showPagePosts, setShowPagePosts] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [isOpen, setIsOpen] = useState(false);

  const categories = preferences?.category_choices ?? [];

  const handleFilterChange = (newFilters: {
    showFriendPosts?: boolean;
    showPagePosts?: boolean;
    selectedCategory?: string;
  }) => {
    if (newFilters.showFriendPosts !== undefined) {
      setShowFriendPosts(newFilters.showFriendPosts);
    }
    if (newFilters.showPagePosts !== undefined) {
      setShowPagePosts(newFilters.showPagePosts);
    }
    if (newFilters.selectedCategory !== undefined) {
      setSelectedCategory(newFilters.selectedCategory);
    }

    onFiltersChange?.({
      showFriendPosts: newFilters.showFriendPosts ?? showFriendPosts,
      showPagePosts: newFilters.showPagePosts ?? showPagePosts,
      selectedCategory: newFilters.selectedCategory ?? selectedCategory,
    });
  };

  if (loading) {
    return (
      <div className="flex gap-2 pb-4">
        <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm mb-4">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Content Type Toggles */}
          <button
            onClick={() => handleFilterChange({ showFriendPosts: !showFriendPosts })}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              showFriendPosts
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            title="Toggle friend posts"
          >
            <span>👥</span>
            <span>Friends</span>
          </button>

          <button
            onClick={() => handleFilterChange({ showPagePosts: !showPagePosts })}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              showPagePosts
                ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            title="Toggle page posts"
          >
            <span>📄</span>
            <span>Pages</span>
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200" />

          {/* Category Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              title="Filter by category"
            >
              <span>🏷️</span>
              <span>{selectedCategory ? "Category: " + selectedCategory : "All Categories"}</span>
              <svg
                className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {isOpen && categories.length > 0 && (
              <div className="absolute left-0 top-full mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg z-20">
                <button
                  onClick={() => {
                    setSelectedCategory(undefined);
                    setIsOpen(false);
                    handleFilterChange({ selectedCategory: undefined });
                  }}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-t-lg first:rounded-t-lg"
                >
                  All Categories
                </button>
                {categories.map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => {
                      setSelectedCategory(code);
                      setIsOpen(false);
                      handleFilterChange({ selectedCategory: code });
                    }}
                    className={`block w-full px-4 py-2 text-left text-sm transition ${
                      selectedCategory === code
                        ? "bg-blue-100 text-blue-700"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Filters Badge */}
          {(selectedCategory || !showFriendPosts || !showPagePosts) && (
            <div className="flex items-center gap-1 ml-auto text-xs text-gray-600">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                Filters active
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
