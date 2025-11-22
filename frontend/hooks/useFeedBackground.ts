"use client";

import { useState, useEffect } from "react";
import type { FeedBackgroundTheme } from "@/components/modals/FeedBackgroundModal";

const STORAGE_KEY = "feed-background-theme";
const DEFAULT_THEME: FeedBackgroundTheme = "default";

export type BackgroundType = FeedBackgroundTheme | string; // string for image URLs

export function useFeedBackground() {
  const [theme, setTheme] = useState<BackgroundType>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // Check if it's a theme or an image URL
        if (isValidTheme(stored)) {
          setTheme(stored as FeedBackgroundTheme);
        } else if (stored.startsWith("/backgrounds/")) {
          // It's an image URL
          setTheme(stored);
        }
      }
    }
  }, []);

  const changeTheme = (newTheme: BackgroundType) => {
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newTheme);
    }
  };

  return { theme, changeTheme, mounted };
}

function isValidTheme(value: string): boolean {
  return [
    "default",
    "american",
    "christmas",
    "clouds",
    "nature",
    "space",
    "ocean",
    "forest",
    "stars",
  ].includes(value);
}

