"use client";

import { useAuth } from "@/lib/auth-context";
import {
  useCallback,
  useMemo,
  useRef,
  type MouseEventHandler,
} from "react";
import Navbar from "../components/navbar";

export default function LandingPage() {
  const { user, isAuthenticated, hydrated } = useAuth();
  const rippleLayerRef = useRef<HTMLDivElement | null>(null);
  const spawnRipple = useCallback((x: number, y: number) => {
    const layer = rippleLayerRef.current;
    if (!layer) return;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    layer.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }, []);

  const handleHeroClick = useCallback<MouseEventHandler<HTMLDivElement>>(
    (e) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      spawnRipple(e.clientX - rect.left, e.clientY - rect.top);
    },
    [spawnRipple]
  );
  const displayName = useMemo(() => {
    if (!user) return "";
    const first = (user.first_name || "").trim();
    if (first) return first;
    const username = (user.username || "").trim();
    if (username) return username;
    if (user.email) return user.email.split("@")[0] ?? "";
    return "";
  }, [user]);
  const isLoggedIn = hydrated && isAuthenticated && !!user;

  return (
  <main className="relative overflow-hidden bg-primary text-(--color-white)">
      <Navbar />
      {/* ========================== HERO ========================== */}
      <section
        onClick={handleHeroClick}
        className="relative pt-32 md:pt-40 pb-28 md:pb-36 px-6 flex flex-col items-center text-center"
      >
        {/* Single prominent geometric shape: a large cobalt ring */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          <svg
            className="absolute -top-24 right-[-10%] w-[640px] h-[640px] opacity-70"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="rgba(11,61,145,0)" />
                <stop offset="95%" stopColor="rgba(11,61,145,0.25)" />
                <stop offset="100%" stopColor="rgba(11,61,145,0.45)" />
              </radialGradient>
              <filter
                id="ringBlur"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>
            <circle
              cx="300"
              cy="300"
              r="250"
              fill="url(#ringGrad)"
              filter="url(#ringBlur)"
            />
          </svg>

          {/* Soft warm wash bottom-left to balance the ring */}
          <svg
            className="absolute bottom-[-80px] left-[-60px] w-[420px] h-[420px] opacity-50"
            viewBox="0 0 400 400"
          >
            <defs>
              <radialGradient id="warmWash" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,77,79,0.22)" />
                <stop offset="100%" stopColor="rgba(255,77,79,0.0)" />
              </radialGradient>
            </defs>
            <circle cx="200" cy="200" r="200" fill="url(#warmWash)" />
          </svg>
        </div>

        {/* Ripple layer - HERO ONLY */}
        <div ref={rippleLayerRef} className="ripple-layer" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <h1 className="animated-gradient-text text-5xl md:text-7xl font-extrabold leading-tight">
            Connect Freely. Express Boldly.
          </h1>
          {isLoggedIn && (
            <p className="mt-4 text-xl font-semibold text-(--color-white)">
              Welcome back{displayName ? `, ${displayName}` : ""}!
            </p>
          )}
          <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            Liberty Social is a premium, human-first social space where your
            voice looks and feels as powerful as it sounds.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/app"
              className="btn-primary px-8 py-4 rounded-[12px] text-lg inline-flex items-center justify-center"
            >
              {isLoggedIn ? "Jump back into Liberty Social" : "Open Liberty Social"}
            </a>
            {!isLoggedIn && (
                <a
                  href="/auth"
                  className="px-8 py-4 rounded-[12px] font-medium text-lg bg-white text-(--color-deep-navy)
                             hover:opacity-90 transition shadow-md"
                >
                  Create your account
                </a>
            )}
          </div>
        </div>

        {/* Wavy divider (bottom of HERO) */}
        <HeroWaveBottom />
      </section>

      {/* ========================== FEATURES ========================== */}
  <section id="features" className="relative bg-white pt-20 pb-24">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Freedom to Speak",
              desc: "Share your opinions without friction. Clear controls, zero clutter.",
            },
            {
              title: "Beautifully Private",
              desc: "Own your presence. Clear privacy defaults and visible choices.",
            },
            {
              title: "Community by Design",
              desc: "Join spaces that celebrate people, not just posts.",
            },
          ].map((f, i) => (
        <article
          key={i}
          className="group relative overflow-hidden rounded-[24px] p-8 bg-metallic-silver shadow-md transition-transform hover:-translate-y-1"
              style={{ boxShadow: "0 10px 30px rgba(11, 61, 145, 0.08)" }}
            >
              {/* content */}
              <h3 className="text-2xl font-extrabold text-(--color-deep-navy) mb-3">
                {f.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">{f.desc}</p>

              {/* gradient flow bar on hover */}
              <div
                className="pointer-events-none absolute left-0 bottom-0 h-[6px] w-0 transition-all duration-500 ease-out group-hover:w-full"
                style={{ background: "linear-gradient(90deg,var(--color-deep-navy),var(--color-rich-red-top))" }}
              />
              {/* subtle glow that fades in with the bar */}
              <div
                className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 w-1/3 h-12 rounded-full blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-40"
                style={{ background: "linear-gradient(90deg,var(--color-deep-navy),var(--color-rich-red-top))" }}
              />
            </article>
          ))}
        </div>

        <WaveBottom fill="var(--color-background)" />
      </section>

      {/* ========================== PEOPLE-FIRST STRIP ========================== */}
      <section id="community" className="relative py-20 md:py-28 bg-(--color-deep-navy)">
        {/* soft backdrop that blends with your palette */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[var(--metallic-accent)] opacity-[0.55]"
        />

        <div className="relative max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          {/* Left: text content */}
          <div className="order-2 md:order-1 rounded-[24px] p-8">
            <h4 className="text-3xl font-extrabold mb-4 text-white">
              A Place Designed for People
            </h4>
            <p className="text-white/90 leading-relaxed">
              We&apos;re building a platform that respects time, attention, and
              identity. Clean design meets strong values so you can focus on
              real connection.
            </p>
            <a
              href="/discover"
              className="mt-5 inline-block gradient-underline text-white"
            >
              Explore communities
            </a>
          </div>

          {/* Right: image showcase (side-by-side) */}
          <div className="order-1 md:order-2">
            <div className="relative w-full aspect-[4/3] rounded-[24px] overflow-hidden shadow-md bg-white">
              {/* If your file is logo or a product shot, drop it in /public/images and update src */}
              {/* For a clean crop look, we use object-contain; switch to object-cover for full bleed */}
              <img
                src="/images/_showcase.jpeg"
                alt="Liberty Social preview"
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
              />
              {/* subtle brand gradient bar along the bottom for polish */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[6px]
                        bg-[linear-gradient(90deg,var(--color-deep-navy),var(--color-rich-red-top))] opacity-80"
              />
            </div>
          </div>
        </div>

        {/* Curved visual separator */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
          <svg
            viewBox="0 0 1440 120"
            className="w-full h-24"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--color-deep-navy)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--color-deeper-navy)" />
              </linearGradient>
            </defs>
            <path
              d="M0,64 C240,128 480,0 720,64 C960,128 1200,32 1440,64 L1440,160 L0,160 Z"
              fill="url(#waveGradient)"
                className="translate-y-[1px]"
            />
          </svg>
        </div>
      </section>

      {/* ========================== LIVE CTA (no "request access") ========================== */}
      <section
        id="cta"
        className="relative text-center text-white py-24 md:py-32"
      >
        {/* Rich background gradient */}
        <div aria-hidden className="absolute inset-0 bg-linear-to-b from-(--color-deep-navy) to-(--color-deeper-navy) opacity-95"></div>

        <div className="relative max-w-3xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 animated-gradient-text">
            Your Voice. Your Space. Your Liberty.
          </h2>
          <p className="text-lg mb-10 text-white/90">
            Jump in now - build your profile, create a space, and connect.
          </p>
          <div className="flex gap-4 justify-center flex-col sm:flex-row">
            {isLoggedIn ? (
              <a
                href="/app"
                className="btn-primary inline-block text-white font-semibold px-10 py-4 rounded-xl hover:opacity-90 transition shadow-metallic"
              >
                Go to your home
              </a>
            ) : (
              <>
                <a
                  href="/auth"
                  className="btn-primary inline-block text-white font-semibold px-10 py-4 rounded-xl hover:opacity-90 transition shadow-metallic"
                >
                  Create your account
                </a>
                <a
                  href="/app"
                  className="inline-block bg-white text-(--color-deep-navy) font-semibold px-10 py-4 rounded-xl
                             hover:opacity-90 transition shadow-md"
                >
                  Explore the app
                </a>
              </>
            )}
          </div>
        </div>

        {/* Subtle inset wave */}
        <WaveTop fill="#FFFFFF" />
      </section>
    </main>
  );
}

/* ========================== WAVES / DIVIDERS ========================== */

function HeroWaveBottom() {
  return (
    <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
      <svg
        viewBox="0 0 1440 120"
        className="w-full h-24"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="heroWaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-deep-navy)" stopOpacity="0" />
            <stop offset="100%" stopColor="white" />
          </linearGradient>
        </defs>
        <path
          d="M0,64 C240,128 480,0 720,64 C960,128 1200,32 1440,64 L1440,160 L0,160 Z"
          fill="url(#heroWaveGradient)"
          className="translate-y-[1px]"
        />
      </svg>
    </div>
  );
}

function WaveBottom({ fill }: { fill: string }) {
  return (
    <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
      <svg
        viewBox="0 0 1440 120"
        className="w-full h-24"
        preserveAspectRatio="none"
      >
        <path
          d="M0,64 C240,128 480,0 720,64 C960,128 1200,32 1440,64 L1440,160 L0,160 Z"
            fill={fill}
        />
      </svg>
    </div>
  );
}

function WaveTop({ fill }: { fill: string }) {
  return (
    <div className="absolute -top-24 left-0 w-full overflow-hidden leading-none rotate-180">
      <svg
        viewBox="0 0 1440 120"
        className="w-full h-24"
        preserveAspectRatio="none"
      >
        <path
          d="M0,64 C240,128 480,0 720,64 C960,128 1200,32 1440,64 L1440,160 L0,160 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
