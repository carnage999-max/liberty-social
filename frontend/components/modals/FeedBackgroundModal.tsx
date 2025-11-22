"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { BackgroundType } from "@/hooks/useFeedBackground";

export type FeedBackgroundTheme = 
  | "default"
  | "american"
  | "christmas"
  | "clouds"
  | "nature"
  | "space"
  | "ocean"
  | "forest"
  | "stars";

interface FeedBackgroundModalProps {
  open: boolean;
  onClose: () => void;
  currentTheme: BackgroundType;
  onThemeChange: (theme: BackgroundType) => void;
}

const THEMES: Array<{ id: FeedBackgroundTheme; name: string; emoji: string; description: string }> = [
  { id: "default", name: "Default", emoji: "🎨", description: "Clean default background" },
  { id: "american", name: "American", emoji: "🇺🇸", description: "Patriotic stars and stripes" },
  { id: "christmas", name: "Christmas", emoji: "🎄", description: "Festive holiday cheer" },
  { id: "clouds", name: "Clouds", emoji: "☁️", description: "Soft floating clouds" },
  { id: "nature", name: "Nature", emoji: "🌿", description: "Natural greenery" },
  { id: "space", name: "Space", emoji: "🚀", description: "Cosmic stars and planets" },
  { id: "ocean", name: "Ocean", emoji: "🌊", description: "Calming ocean waves" },
  { id: "forest", name: "Forest", emoji: "🌲", description: "Woodland trees" },
  { id: "stars", name: "Stars", emoji: "⭐", description: "Twinkling night sky" },
];

export default function FeedBackgroundModal({
  open,
  onClose,
  currentTheme,
  onThemeChange,
}: FeedBackgroundModalProps) {
  const [selectedTheme, setSelectedTheme] = useState<BackgroundType>(currentTheme);
  const [imageBackgrounds, setImageBackgrounds] = useState<Array<{ url: string; type: "image" | "video" }>>([]);
  const [loadingImages, setLoadingImages] = useState(true);

  useEffect(() => {
    setSelectedTheme(currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    if (open) {
      // Fetch available background images and videos
      fetch("/api/backgrounds")
        .then((res) => res.json())
        .then((data) => {
          setImageBackgrounds(data.backgrounds || []);
          setLoadingImages(false);
        })
        .catch((err) => {
          console.error("Failed to load background media:", err);
          setLoadingImages(false);
        });
    }
  }, [open]);

  if (!open) return null;

  const handleSelect = (theme: BackgroundType) => {
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className="w-full max-w-2xl my-auto rounded-[16px] border-2 p-4 sm:p-6 max-h-[90vh] flex flex-col"
          style={{
            backgroundColor: "var(--color-deep-navy)",
            borderColor: "var(--color-gold)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Header - Fixed */}
          <div className="mb-4 sm:mb-6 flex items-center justify-between shrink-0">
            <h2
              className="text-base sm:text-lg font-semibold"
              style={{ color: "var(--color-gold)" }}
            >
              Choose Feed Background
            </h2>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 shrink-0"
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

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto pr-1 -mr-1">
            {/* CSS Theme Grid */}
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-white/80">Themed Backgrounds</h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleSelect(theme.id)}
                    className={`group flex flex-col items-center gap-2 rounded-[12px] border-2 px-3 py-3 sm:px-4 sm:py-4 transition ${
                      selectedTheme === theme.id
                        ? "border-(--color-gold) bg-(--color-gold)/20"
                        : "border-white/20 hover:border-white/40 hover:bg-white/5"
                    }`}
                    title={theme.description}
                  >
                    <span className="text-2xl sm:text-3xl">{theme.emoji}</span>
                    <span
                      className={`text-xs sm:text-sm font-medium ${
                        selectedTheme === theme.id
                          ? "text-(--color-gold)"
                          : "text-white/70 group-hover:text-white/90"
                      }`}
                    >
                      {theme.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Image and Video Backgrounds */}
            {imageBackgrounds.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-white/80">Image & Video Backgrounds</h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3">
                  {imageBackgrounds.map((media) => {
                    const mediaName = media.url.split("/").pop()?.replace(/\.[^/.]+$/, "") || "Background";
                    const isSelected = selectedTheme === media.url;
                    return (
                      <button
                        key={media.url}
                        onClick={() => handleSelect(media.url)}
                        className={`group relative overflow-hidden rounded-[12px] border-2 transition ${
                          isSelected
                            ? "border-(--color-gold) ring-2 ring-(--color-gold)/50"
                            : "border-white/20 hover:border-white/40"
                        }`}
                        title={mediaName}
                      >
                        <div className="aspect-square relative bg-black/20">
                          {media.type === "video" ? (
                            <video
                              src={media.url}
                              className="h-full w-full object-cover"
                              muted
                              loop
                              playsInline
                              autoPlay
                            />
                          ) : (
                            <Image
                              src={media.url}
                              alt={mediaName}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 50vw, 33vw"
                            />
                          )}
                          <div
                            className={`absolute inset-0 transition ${
                              isSelected
                                ? "bg-(--color-gold)/20"
                                : "bg-black/0 group-hover:bg-black/10"
                            }`}
                          />
                          {media.type === "video" && (
                            <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 sm:p-2">
                          <span
                            className={`block truncate text-[10px] sm:text-xs font-medium ${
                              isSelected ? "text-(--color-gold)" : "text-white/90"
                            }`}
                          >
                            {mediaName}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {loadingImages && (
              <div className="text-center text-sm text-white/60 py-4">
                Loading image backgrounds...
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

