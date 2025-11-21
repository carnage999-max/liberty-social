"use client";

import { useState } from "react";

export default function CollapsibleFloatingButtons({
  onCreatePost,
  onReportBug,
}: {
  onCreatePost: () => void;
  onReportBug: () => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="fixed bottom-24 right-6 z-40 sm:bottom-8 flex flex-col items-end gap-3">
      {/* Expanded buttons */}
      {!isCollapsed && (
        <>
          {/* Create Post Button */}
          <button
            type="button"
            aria-label="Create post"
            onClick={onCreatePost}
            className="flex h-14 w-14 items-center justify-center rounded-full btn-primary text-white shadow-metallic transition hover:scale-105 active:scale-95"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Bug Report Button */}
          <button
            type="button"
            aria-label="Report bug"
            onClick={onReportBug}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-(--color-gold) text-(--color-deeper-navy) shadow-metallic hover:scale-105 transition-transform text-2xl"
            title="Report a bug"
          >
            🐞
          </button>
        </>
      )}

      {/* Toggle Button (always visible, slides to side when collapsed) */}
      <button
        type="button"
        aria-label={isCollapsed ? "Show action buttons" : "Hide action buttons"}
        aria-expanded={!isCollapsed}
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 ease-out shadow-metallic hover:scale-105 active:scale-95 ${
          isCollapsed
            ? "bg-white/20 text-white"
            : "bg-(--color-gold) text-(--color-deeper-navy)"
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          className={`transition-transform duration-300 ${isCollapsed ? "" : "rotate-45"}`}
        >
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Collapsed state - slide out indicator */}
      {isCollapsed && (
        <div className="absolute right-0 top-0 h-14 w-14 rounded-full bg-white/10 backdrop-blur-sm animate-pulse" />
      )}
    </div>
  );
}
