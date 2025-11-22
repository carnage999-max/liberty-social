"use client";

import { useState, useEffect, useRef } from "react";
import { CATEGORY_CHOICES } from "./FeedFilters";

interface FeedFilterTabsProps {
  onFiltersChange: (filters: {
    showFriendPosts: boolean;
    showPagePosts: boolean;
    selectedCategory?: string;
  }) => void;
}

export default function FeedFilterTabs({ onFiltersChange }: FeedFilterTabsProps) {
  // Default: both inactive (white) = show all posts
  const [friendPostsActive, setFriendPostsActive] = useState(false);
  const [pagePostsActive, setPagePostsActive] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [tabsVisible, setTabsVisible] = useState(true);
  const prevFiltersRef = useRef<{
    friendPostsActive: boolean;
    pagePostsActive: boolean;
    selectedCategories: Set<string>;
  } | null>(null);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleFriendPosts = () => {
    if (friendPostsActive) {
      // If active, deactivate it (show all posts)
      setFriendPostsActive(false);
      setPagePostsActive(false);
    } else {
      // If inactive, activate it and deactivate pages (show only friend posts)
      setFriendPostsActive(true);
      setPagePostsActive(false);
    }
  };

  const togglePagePosts = () => {
    if (pagePostsActive) {
      // If active, deactivate it (show all posts)
      setFriendPostsActive(false);
      setPagePostsActive(false);
    } else {
      // If inactive, activate it and deactivate friends (show only page posts)
      setFriendPostsActive(false);
      setPagePostsActive(true);
    }
  };

  useEffect(() => {
    const currentFilters = {
      friendPostsActive,
      pagePostsActive,
      selectedCategories,
    };

    const hasChanged =
      !prevFiltersRef.current ||
      prevFiltersRef.current.friendPostsActive !== friendPostsActive ||
      prevFiltersRef.current.pagePostsActive !== pagePostsActive ||
      prevFiltersRef.current.selectedCategories !== selectedCategories;

    if (hasChanged) {
      prevFiltersRef.current = currentFilters;
      // Convert selected categories to array format for backend
      const selectedArray = Array.from(selectedCategories);
      
      // When both are inactive (false), show all posts (both true to backend)
      // When one is active, show only that type
      const showFriendPosts = friendPostsActive || (!friendPostsActive && !pagePostsActive);
      const showPagePosts = pagePostsActive || (!friendPostsActive && !pagePostsActive);
      
      onFiltersChange({
        showFriendPosts,
        showPagePosts,
        selectedCategory: selectedArray.length > 0 ? selectedArray.join(",") : undefined,
      });
    }
  }, [friendPostsActive, pagePostsActive, selectedCategories, onFiltersChange]);

  const hasActiveFilters = friendPostsActive || pagePostsActive || selectedCategories.size > 0;

  return (
    <div>
      {/* Header with Toggle Button */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
        <div className="text-xs font-semibold text-gray-600">
          {hasActiveFilters && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-700">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              Filters active
            </span>
          )}
        </div>
        <button
          onClick={() => setTabsVisible(!tabsVisible)}
          className="text-xs font-medium text-gray-600 hover:text-gray-800 transition"
          title={tabsVisible ? "Hide filters" : "Show filters"}
        >
          {tabsVisible ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </button>
      </div>

      {/* Tabs Container */}
      {tabsVisible && (
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
          <div className="px-4 py-3 overflow-x-auto">
            <div className="flex items-center gap-3 min-w-min">
              {/* Friend Posts Tab */}
              <button
                onClick={toggleFriendPosts}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition border-2 whitespace-nowrap flex-shrink-0 ${
                  friendPostsActive
                    ? "bg-[var(--color-deep-navy)] text-white border-[var(--color-gold)]"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
                title={friendPostsActive ? "Show all posts" : "Show only friend posts"}
              >
                <span>👥</span>
                <span>Friends</span>
              </button>

              {/* Page Posts Tab */}
              <button
                onClick={togglePagePosts}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition border-2 whitespace-nowrap flex-shrink-0 ${
                  pagePostsActive
                    ? "bg-[var(--color-deep-navy)] text-white border-[var(--color-gold)]"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
                title={pagePostsActive ? "Show all posts" : "Show only page posts"}
              >
                <span>📄</span>
                <span>Pages</span>
              </button>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-300 flex-shrink-0" />

              {/* Category Tabs */}
              {CATEGORY_CHOICES.map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => toggleCategory(code)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition border-2 whitespace-nowrap flex-shrink-0 ${
                    selectedCategories.has(code)
                      ? "bg-[var(--color-deep-navy)] text-white border-[var(--color-gold)]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                  title={`Filter by ${label}`}
                >
                  {label}
                </button>
              ))}

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setFriendPostsActive(false);
                    setPagePostsActive(false);
                    setSelectedCategories(new Set());
                  }}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border-2 border-red-200 hover:bg-red-100 transition whitespace-nowrap flex-shrink-0"
                  title="Clear all filters"
                >
                  <span>✕</span>
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
