"use client";

import { useRef, useState } from "react";
import { LINK_GRADIENT } from "../lib/constants";

type Ripple = { id: string; x: number; y: number };

export default function HomePage() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const containerRef = useRef<HTMLElement | null>(null);

  function createRipple(clientX: number, clientY: number) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setRipples((s) => [...s, { id, x, y }]);
    // remove after animation
    setTimeout(() => {
      setRipples((s) => s.filter((r) => r.id !== id));
    }, 950);
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    // trigger ripple on tap/click only
    createRipple(e.clientX, e.clientY);
  }

  return (
    <main
      ref={containerRef}
      onPointerDown={onPointerDown}
      className="relative isolate flex items-center justify-center min-h-screen px-6 py-24 overflow-hidden bg-gradient-to-b from-[var(--color-background)] to-white"
    >
      {/* decorative gradient blobs */}
      <div
        className="absolute -top-40 left-1/2 -z-10 w-[60rem] max-w-none -translate-x-1/2 blur-3xl opacity-30"
        style={{ background: "linear-gradient(90deg,#0B3D91 0%, #6C5CE7 40%, #FF6B6B 100%)", height: 420 }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-48 right-1/4 -z-10 w-[48rem] max-w-none blur-2xl opacity-20"
        style={{
          background:
            "radial-gradient(circle at 20% 30%, rgba(255,77,79,0.18), transparent 20%), radial-gradient(circle at 80% 70%, rgba(11,61,145,0.12), transparent 25%)",
          height: 360,
        }}
        aria-hidden="true"
      />

      {/* ripple layer (ripples appended here) */}
      <div className="ripple-layer" aria-hidden="true">
        {ripples.map((r) => (
          <div key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />
        ))}
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto" style={{ ['--link-gradient' as any]: LINK_GRADIENT }}>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-tight mb-6 tracking-tight animated-gradient-text" style={{ fontFamily: "Inter, system-ui, -apple-system" }}>
          Liberty Social
        </h1>

        <p className="mx-auto text-lg sm:text-xl text-gray-600 max-w-2xl mb-8">A new social experience built for honest conversation and meaningful connection. We're building something different — see you soon.</p>

        <div className="mt-6 inline-flex items-center gap-4 justify-center">
          <span className="px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ background: "linear-gradient(90deg,#FF6B6B,#FF4D4F)" }}>Coming soon</span>
        </div>
      </div>
    </main>
  );
}
