"use client";

import { useState, useEffect } from "react";

export type FeedBackgroundTheme = 
  | "default"
  | "american"
  | "christmas"
  | "halloween"
  | "clouds"
  | "nature"
  | "space"
  | "ocean"
  | "forest"
  | "sunset"
  | "stars";

interface FeedBackgroundModalProps {
  open: boolean;
  onClose: () => void;
  currentTheme: FeedBackgroundTheme;
  onThemeChange: (theme: FeedBackgroundTheme) => void;
}

const THEMES: Array<{ id: FeedBackgroundTheme; name: string; emoji: string; description: string }> = [
  { id: "default", name: "Default", emoji: "🎨", description: "Clean default background" },
  { id: "american", name: "American", emoji: "🇺🇸", description: "Patriotic stars and stripes" },
  { id: "christmas", name: "Christmas", emoji: "🎄", description: "Festive holiday cheer" },
  { id: "halloween", name: "Halloween", emoji: "🎃", description: "Spooky autumn vibes" },
  { id: "clouds", name: "Clouds", emoji: "☁️", description: "Soft floating clouds" },
  { id: "nature", name: "Nature", emoji: "🌿", description: "Natural greenery" },
  { id: "space", name: "Space", emoji: "🚀", description: "Cosmic stars and planets" },
  { id: "ocean", name: "Ocean", emoji: "🌊", description: "Calming ocean waves" },
  { id: "forest", name: "Forest", emoji: "🌲", description: "Woodland trees" },
  { id: "sunset", name: "Sunset", emoji: "🌅", description: "Warm sunset colors" },
  { id: "stars", name: "Stars", emoji: "⭐", description: "Twinkling night sky" },
];

export default function FeedBackgroundModal({
  open,
  onClose,
  currentTheme,
  onThemeChange,
}: FeedBackgroundModalProps) {
  const [selectedTheme, setSelectedTheme] = useState<FeedBackgroundTheme>(currentTheme);

  useEffect(() => {
    setSelectedTheme(currentTheme);
  }, [currentTheme]);

  if (!open) return null;

  const handleSelect = (theme: FeedBackgroundTheme) => {
    setSelectedTheme(theme);
    onThemeChange(theme);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-2xl rounded-[16px] border-2 p-6"
          style={{
            backgroundColor: "var(--color-deep-navy)",
            borderColor: "var(--color-gold)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--color-gold)" }}
            >
              Choose Feed Background
            </h2>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10"
              aria-label="Close modal"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--color-gold)" }}
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Theme Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleSelect(theme.id)}
                className={`group flex flex-col items-center gap-2 rounded-[12px] border-2 px-4 py-4 transition ${
                  selectedTheme === theme.id
                    ? "border-[var(--color-gold)] bg-[var(--color-gold)]/20"
                    : "border-white/20 hover:border-white/40 hover:bg-white/5"
                }`}
                title={theme.description}
              >
                <span className="text-3xl">{theme.emoji}</span>
                <span
                  className={`text-sm font-medium ${
                    selectedTheme === theme.id
                      ? "text-[var(--color-gold)]"
                      : "text-white/70 group-hover:text-white/90"
                  }`}
                >
                  {theme.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

