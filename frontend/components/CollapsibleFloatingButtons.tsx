"use client";

import { useState } from "react";

export default function FloatingCreateButton({ onOpen }: { onOpen: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return (
      <>
        {/* Peeking button - shows when dismissed */}
        <button
          onClick={() => setDismissed(false)}
          className="fixed bottom-24 right-2 z-40 h-14 w-6 rounded-l-full shadow-metallic hover:opacity-80 transition-all flex items-center justify-center overflow-hidden group btn-primary text-white"
          aria-label="Show create post"
          title="Create post"
          style={{
            opacity: 0.6,
          }}
        >
          <span className="group-hover:scale-150 transition-transform opacity-60 group-hover:opacity-100">+</span>
        </button>
      </>
    );
  }

  return (
    <>
      {/* Floating button with dismiss X */}
      <div className="fixed bottom-24 right-6 z-40">
        <div className="relative w-14 h-14">
          <button
            type="button"
            aria-label="Create post"
            onClick={onOpen}
            className="absolute inset-0 flex h-14 w-14 items-center justify-center rounded-full btn-primary text-white shadow-metallic transition hover:scale-105 active:scale-95"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {/* X button to dismiss */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            className="absolute -top-2 -right-2 h-6 w-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md hover:bg-rose-600 transition-colors z-10"
            aria-label="Dismiss create post button"
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}
