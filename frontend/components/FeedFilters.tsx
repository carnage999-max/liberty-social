"use client";

import { useState, useEffect, useRef } from "react";

export const CATEGORY_CHOICES = [
  ["business", "Business"],
  ["community", "Community"],
  ["brand", "Brand"],
  ["news", "News"],
  ["restaurant", "Restaurant"],
  ["entertainment", "Entertainment"],
  ["hobbies", "Hobbies"],
  ["work", "Work"],
  ["associates", "Associates"],
  ["sports", "Sports"],
  ["music", "Music"],
  ["art", "Art"],
  ["tech", "Technology"],
  ["lifestyle", "Lifestyle"],
  ["education", "Education"],
  ["health", "Health & Wellness"],
  ["travel", "Travel"],
  ["food", "Food & Cooking"],
  ["fashion", "Fashion"],
  ["games", "Games"],
  ["other", "Other"],
] as [string, string][];

interface FeedFiltersProps {
  onFiltersChange: (filters: {
    showFriendPosts: boolean;
    showPagePosts: boolean;
    selectedCategory?: string;
  }) => void;
}

/**
 * Feed filter component that works with django-filters backend.
 * 
 * Backend Query Logic:
 * - show_friend_posts=true, show_page_posts=true: Show all posts (default)
 * - show_friend_posts=true, show_page_posts=false: Show only friend posts (page__isnull=true)
 * - show_friend_posts=false, show_page_posts=true: Show only page posts (page__isnull=false)
 * - preferred_categories=<code>: Show page posts from category + all friend posts
 */
export default function FeedFilters({ onFiltersChange }: FeedFiltersProps) {
  const [friendPostsActive, setFriendPostsActive] = useState(true);
  const [pagePostsActive, setPagePostsActive] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  // Track previous filter state to only notify on actual changes
  const prevFiltersRef = useRef<{
    friendPostsActive: boolean;
    pagePostsActive: boolean;
    selectedCategory?: string;
  } | null>(null);

  // Only notify parent when filters actually change
  useEffect(() => {
    const currentFilters = {
      friendPostsActive,
      pagePostsActive,
      selectedCategory,
    };

    // Check if filters have actually changed
    const hasChanged =
      !prevFiltersRef.current ||
      prevFiltersRef.current.friendPostsActive !== friendPostsActive ||
      prevFiltersRef.current.pagePostsActive !== pagePostsActive ||
      prevFiltersRef.current.selectedCategory !== selectedCategory;

    if (hasChanged) {
      prevFiltersRef.current = currentFilters;
      onFiltersChange({
        showFriendPosts: friendPostsActive,
        showPagePosts: pagePostsActive,
        selectedCategory,
      });
    }
  }, [friendPostsActive, pagePostsActive, selectedCategory, onFiltersChange]);

  const toggleFriendPosts = () => {
    setFriendPostsActive(!friendPostsActive);
  };

  const togglePagePosts = () => {
    setPagePostsActive(!pagePostsActive);
  };

  const selectCategory = (code?: string) => {
    setSelectedCategory(code);
    setCategoryDropdownOpen(false);
  };

  const hasActiveFilters = !friendPostsActive || !pagePostsActive || !!selectedCategory;
  const selectedCategoryLabel = selectedCategory
    ? CATEGORY_CHOICES.find(([code]) => code === selectedCategory)?.[1] || selectedCategory
    : "All Categories";

  return (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm mb-4">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Friend Posts Toggle */}
          <button
            onClick={toggleFriendPosts}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition border ${
              friendPostsActive
                ? "bg-[var(--color-deep-navy)] text-white border-2 border-[var(--color-gold)] hover:bg-opacity-90"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
            title="Toggle friend posts"
          >
            <span>👥</span>
            <span>Friends</span>
          </button>

          {/* Page Posts Toggle */}
          <button
            onClick={togglePagePosts}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition border ${
              pagePostsActive
                ? "bg-[var(--color-deep-navy)] text-white border-2 border-[var(--color-gold)] hover:bg-opacity-90"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
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
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              title="Filter by category"
            >
              <span>🏷️</span>
              <span>{selectedCategoryLabel}</span>
              <svg
                className={`h-4 w-4 transition ${categoryDropdownOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {categoryDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg z-20 max-h-96 overflow-y-auto">
                <button
                  onClick={() => selectCategory(undefined)}
                  className={`block w-full px-4 py-2 text-left text-sm transition ${
                    !selectedCategory
                      ? "bg-[var(--color-deep-navy)] text-white"
                      : "text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  All Categories
                </button>
                {CATEGORY_CHOICES.map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => selectCategory(code)}
                    className={`block w-full px-4 py-2 text-left text-sm transition ${
                      selectedCategory === code
                        ? "bg-[var(--color-deep-navy)] text-white"
                        : "text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Filters Badge */}
          {hasActiveFilters && (
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
