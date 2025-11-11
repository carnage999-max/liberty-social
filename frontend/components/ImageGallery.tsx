"use client";

import { useEffect } from "react";
import Image from "next/image";

export interface ImageGalleryProps {
  open: boolean;
  onClose: () => void;
  images: string[];
  currentIndex: number;
  onNavigate?: (direction: "prev" | "next") => void;
  onSelect?: (index: number) => void;
  title?: string;
  caption?: string;
  timestamp?: string;
}

export default function ImageGallery({
  open,
  onClose,
  images,
  currentIndex,
  onNavigate,
  onSelect,
  title,
  caption,
  timestamp,
}: ImageGalleryProps) {
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && onNavigate) {
        onNavigate("prev");
      } else if (e.key === "ArrowRight" && onNavigate) {
        onNavigate("next");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onNavigate]);

  if (!open || images.length === 0) return null;

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;
  const canGoPrev = hasMultiple && currentIndex > 0;
  const canGoNext = hasMultiple && currentIndex < images.length - 1;

  const handlePrev = () => {
    if (canGoPrev && onNavigate) {
      onNavigate("prev");
    }
  };

  const handleNext = () => {
    if (canGoNext && onNavigate) {
      onNavigate("next");
    }
  };

  const handleSelect = (index: number) => {
    if (onSelect) {
      onSelect(index);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-10 sm:px-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl shadow-2xl">
        {/* Image Container */}
        <div className="relative flex flex-1 items-center justify-center bg-gray-900 min-h-[400px] sm:min-h-[500px]">
          {/* Previous Button */}
          {hasMultiple && (
            <button
              type="button"
              onClick={handlePrev}
              disabled={!canGoPrev}
              aria-label="Previous image"
              className={[
                "absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full transition",
                canGoPrev
                  ? "bg-white/90 text-gray-800 shadow-lg hover:bg-white hover:scale-110"
                  : "bg-gray-500/50 text-gray-400 cursor-not-allowed",
              ].join(" ")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 18l-6-6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {/* Image */}
          <div className="relative h-full w-full min-h-[400px] sm:min-h-[500px]">
            <Image
              key={currentImage}
              src={currentImage}
              alt={title || `Gallery image ${currentIndex + 1}`}
              fill
              priority
              sizes="(min-width: 1024px) 900px, 90vw"
              className="object-contain"
            />
          </div>

          {/* Next Button */}
          {hasMultiple && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              aria-label="Next image"
              className={[
                "absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full transition",
                canGoNext
                  ? "bg-white/90 text-gray-800 shadow-lg hover:bg-white hover:scale-110"
                  : "bg-gray-500/50 text-gray-400 cursor-not-allowed",
              ].join(" ")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 18l6-6-6-6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close gallery"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 hover:scale-110"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M6 18L18 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Caption/Info Base with Liberty Social Theme */}
        {(title || caption || timestamp || hasMultiple) && (
          <div
            className="px-6 py-4"
            style={{
              background: "linear-gradient(180deg, var(--color-rich-red-top) 0%, var(--color-rich-red-bottom) 100%)",
              borderTop: "2px solid var(--color-gold)",
            }}
          >
            {/* Title and Timestamp */}
            {(title || timestamp) && (
              <div className="mb-3">
                {title && (
                  <p className="text-base font-semibold text-white">{title}</p>
                )}
                {timestamp && (
                  <p className="text-xs text-white/80 mt-1">
                    {new Date(timestamp).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Caption */}
            {caption && (
              <p className="text-sm text-white/90 mb-3 whitespace-pre-line">{caption}</p>
            )}

            {/* Image Indicators */}
            {hasMultiple && (
              <div className="flex items-center justify-center gap-2">
                {images.map((_, index) => (
                  <button
                    key={`dot-${index}`}
                    type="button"
                    aria-label={`View image ${index + 1}`}
                    onClick={() => handleSelect(index)}
                    className={[
                      "h-2.5 rounded-full transition-all",
                      index === currentIndex
                        ? "w-8 bg-[var(--color-gold)]"
                        : "w-2.5 bg-white/40 hover:bg-white/60",
                    ].join(" ")}
                  />
                ))}
              </div>
            )}

            {/* Image Counter */}
            {hasMultiple && (
              <p className="text-center text-xs text-white/70 mt-2">
                {currentIndex + 1} of {images.length}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

