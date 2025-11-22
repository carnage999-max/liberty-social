"use client";

import { useState, useEffect } from "react";
import type { FeedBackgroundTheme } from "@/components/modals/FeedBackgroundModal";

const STORAGE_KEY = "feed-background-theme";
const DEFAULT_THEME: FeedBackgroundTheme = "default";

export function useFeedBackground() {
  const [theme, setTheme] = useState<FeedBackgroundTheme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidTheme(stored)) {
        setTheme(stored as FeedBackgroundTheme);
      }
    }
  }, []);

  const changeTheme = (newTheme: FeedBackgroundTheme) => {
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
    "halloween",
    "clouds",
    "nature",
    "space",
    "ocean",
    "forest",
    "sunset",
    "stars",
  ].includes(value);
}

