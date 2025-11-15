"use client";

import { useState, useEffect } from "react";
import { useFeedPreferences, type FeedPreference } from "@/hooks/useFeedPreferences";
import { useToast } from "./Toast";

export default function FeedPreferencesSection() {
  const toast = useToast();
  const {
    preferences,
    loading,
    error,
    updatePreferences,
  } = useFeedPreferences();

  const [showFriendPosts, setShowFriendPosts] = useState(true);
  const [showPagePosts, setShowPagePosts] = useState(true);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [showOtherCategories, setShowOtherCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const categories = preferences?.category_choices ?? [];

  // Initialize form from preferences
  useEffect(() => {
    if (!preferences) return;

    setShowFriendPosts(preferences.show_friend_posts);
    setShowPagePosts(preferences.show_page_posts);
    setPreferredCategories(preferences.preferred_categories);
    setShowOtherCategories(preferences.show_other_categories);
    setHasChanges(false);
  }, [preferences]);

  const handleCategoryToggle = (categoryCode: string) => {
    setPreferredCategories((prev) => {
      const updated = prev.includes(categoryCode)
        ? prev.filter((c) => c !== categoryCode)
        : [...prev, categoryCode];
      setHasChanges(true);
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updatePreferences({
        show_friend_posts: showFriendPosts,
        show_page_posts: showPagePosts,
        preferred_categories: preferredCategories,
        show_other_categories: showOtherCategories,
      } as Partial<FeedPreference>);

      if (updated) {
        setHasChanges(false);
        toast.show("Feed preferences updated");
      }
    } catch (err) {
      console.error(err);
      toast.show("Failed to update preferences", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin">
          <svg className="h-6 w-6 text-gray-600" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.1" />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-[18px] border border-gray-100 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
      <h2 className="text-lg font-semibold text-gray-900">Feed Preferences</h2>
      <p className="mt-1 text-sm text-gray-500">
        Customize what posts appear in your feed by selecting content types and page categories you're interested in.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {/* Content Type Filters */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Show posts from:</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showFriendPosts}
                onChange={(e) => {
                  setShowFriendPosts(e.target.checked);
                  setHasChanges(true);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2"
              />
              <span className="text-sm text-gray-700">Friends' posts</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showPagePosts}
                onChange={(e) => {
                  setShowPagePosts(e.target.checked);
                  setHasChanges(true);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2"
              />
              <span className="text-sm text-gray-700">Page posts</span>
            </label>
          </div>
        </div>

        {/* Category Filters */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Interested categories:</h3>
          <div className="space-y-2 mb-4">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500">Loading categories...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {categories.map(([code, label]) => (
                  <label
                    key={code}
                    className="flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 px-3 py-2 hover:border-gray-300 hover:bg-gray-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={preferredCategories.includes(code)}
                      onChange={() => handleCategoryToggle(code)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Show Other Categories Toggle */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <input
              type="checkbox"
              checked={showOtherCategories}
              onChange={(e) => {
                setShowOtherCategories(e.target.checked);
                setHasChanges(true);
              }}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-700">
                Show posts from other categories
              </span>
              <p className="text-xs text-gray-500 mt-1">
                When enabled, you'll see posts from categories outside your selection once you've seen all posts from your preferred categories.
              </p>
            </div>
          </label>
        </div>

        {/* Save Button */}
        <div className="pt-4 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="rounded-lg btn-primary px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {saving ? "Saving..." : "Save preferences"}
          </button>
          {hasChanges && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              ⚠️ You have unsaved changes
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
