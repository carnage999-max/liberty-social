"use client";

import { useAuth } from "@/lib/auth-context";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, hydrated } = useAuth();
  const [raised, setRaised] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const displayName = useMemo(() => {
    if (!user) return "";
    const fromFirst = (user.first_name || "").trim();
    if (fromFirst) return fromFirst;
    const fromUsername = (user.username || "").trim();
    if (fromUsername) return fromUsername;
    if (user.email) return user.email.split("@")[0] ?? "";
    return "";
  }, [user]);
  const initials = displayName ? displayName[0]?.toUpperCase() ?? "U" : "U";
  const avatarSrc = user?.profile_image_url || undefined;
  const showProfile = hydrated && isAuthenticated && !!user;

  const skipNav = pathname?.startsWith("/app/feed");

  // glass nav raise on scroll
  useEffect(() => {
    const onScroll = () => setRaised(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current || !btnRef.current) return;
      if (!menuRef.current.contains(t) && !btnRef.current.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // close on in-page nav clicks
  useEffect(() => {
    const onHash = () => setOpen(false);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return skipNav ? null : (
    <nav
      className={[
        "fixed top-0 inset-x-0 z-40 mx-auto max-w-7xl",
        "transition-all duration-300 ease-out",
        "px-6 md:px-8 py-3 md:py-4",
        "rounded-xl backdrop-blur-md",
        raised ? "bg-white/75 shadow-md" : "bg-white/40 shadow-sm",
      ].join(" ")}
      role="navigation"
      aria-label="Main"
    >
      <div className="flex items-center justify-between">
        {/* Brand: logo + wordmark */}
        <a href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo.png"
            alt="Liberty Social logo"
            width={28}
            height={28}
            priority
            className="rounded-md"
          />
          <span className="text-xl md:text-2xl font-extrabold gradient-underline">
            Liberty Social
          </span>
        </a>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/app"
            className="px-4 py-2 rounded-[12px] font-medium text-[var(--color-primary)] bg-white hover:opacity-90 transition shadow-sm"
          >
            Communities
          </a>
          {showProfile ? (
            <a
              href="/app"
              className="inline-flex items-center gap-3 px-3 py-2 rounded-[12px] bg-white text-[var(--color-primary)] font-medium shadow-sm hover:opacity-90 transition"
              aria-label="Open profile"
            >
              <span className="relative h-9 w-9 overflow-hidden rounded-full bg-[var(--color-primary)]/10 text-sm font-semibold text-[var(--color-primary)] flex items-center justify-center">
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt={`${displayName || "Your"} profile picture`}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  initials
                )}
              </span>
              <span>{displayName || "Profile"}</span>
            </a>
          ) : (
            <a
              href="/signup"
              className="px-4 py-2 rounded-[12px] text-white font-semibold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 transition shadow-metallic"
            >
              Create account
            </a>
          )}
        </div>

        {/* Mobile: hamburger */}
        <button
          ref={btnRef}
          className="md:hidden inline-flex items-center justify-center rounded-lg px-3 py-2 bg-white/70 hover:bg-white/90 shadow-sm transition"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      <div
        id="mobile-menu"
        ref={menuRef}
        className={[
          "md:hidden overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out",
          open
            ? "max-h-64 opacity-100 translate-y-0"
            : "max-h-0 opacity-0 -translate-y-1",
        ].join(" ")}
      >
        <div className="mt-3 rounded-xl bg-white/90 backdrop-blur-md shadow-md p-3">
          <a
            href="/app"
            onClick={() => setOpen(false)}
            className="block w-full text-left px-4 py-3 rounded-lg text-[var(--color-primary)] hover:bg-[var(--metallic-silver)] transition"
          >
            Communities
          </a>
          {showProfile ? (
            <a
              href="/app"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-3 px-4 py-3 rounded-lg text-[var(--color-primary)] font-medium hover:bg-[var(--metallic-silver)] transition"
            >
              <span className="relative h-9 w-9 overflow-hidden rounded-full bg-[var(--color-primary)]/10 text-sm font-semibold text-[var(--color-primary)] flex items-center justify-center">
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt={`${displayName || "Your"} profile picture`}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  initials
                )}
              </span>
              <span>{displayName || "Profile"}</span>
            </a>
          ) : (
            <a
              href="/auth"
              onClick={() => setOpen(false)}
              className="mt-2 block w-full text-left px-4 py-3 rounded-lg text-white font-semibold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 transition shadow-metallic"
            >
              Create account
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
