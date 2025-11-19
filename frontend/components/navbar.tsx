"use client";

import { useAuth } from "@/lib/auth-context";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, hydrated, logout } = useAuth();
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

  const skipNav = pathname?.startsWith("/app");

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
        raised ? "header-bar shadow-md" : "header-bar shadow-sm",
      ].join(" ")}
      role="navigation"
      aria-label="Main"
    >
      <div className="flex items-center justify-between">
        {/* Brand: logo + wordmark (logo centered visual is handled by layout) */}
        <Link href="/" className="flex items-center gap-3">
          <span className="logo-area">
            <Image
              src={raised ? "/images/logo.jpeg" : "/images/logo.png"}
              alt="Liberty Social logo"
              width={36}
              height={36}
              priority
              className="rounded-md"
            />
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xl md:text-2xl font-extrabold gradient-underline">
              Liberty Social
            </span>
          </div>
        </Link>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/app/marketplace"
            className="btn-primary px-4 py-2 inline-flex items-center justify-center"
          >
            Marketplace
          </Link>
          <Link
            href="/app/animals"
            className="btn-primary px-4 py-2 inline-flex items-center justify-center"
          >
            Animals
          </Link>
          <Link
            href="/app/breeders"
            className="btn-primary px-4 py-2 inline-flex items-center justify-center"
          >
            Breeders
          </Link>
          {showProfile ? (
            <>
              <Link
                href="/app"
                className="inline-flex items-center gap-3 px-3 py-2 rounded-[12px] bg-white text-(--color-deep-navy) font-medium shadow-sm hover:opacity-90 transition"
                aria-label="Open profile"
              >
                <span className="relative h-9 w-9 overflow-hidden rounded-full bg-[var(--color-deep-navy)]/10 text-sm font-semibold text-[var(--color-deep-navy)] flex items-center justify-center">
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
              </Link>
              <button
                onClick={() => {
                  void logout();
                }}
                className="inline-flex items-center gap-2 rounded-[12px] btn-primary px-4 py-2 text-sm font-semibold transition hover:opacity-90"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M15 3H6a2 2 0 00-2 2v14a2 2 0 002 2h9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 17l5-5-5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 12h-9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="btn-primary px-4 py-2 text-sm font-semibold"
            >
              Create account
            </Link>
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

      {/* Mobile dropdown - fixed overlay that appears where user is */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div
        id="mobile-menu"
        ref={menuRef}
        className={[
          "md:hidden fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-out",
          open
            ? "translate-y-0"
            : "-translate-y-full",
        ].join(" ")}
        style={{
          paddingTop: "calc(var(--navbar-height, 80px) + 1rem)",
        }}
      >
        <div className="mx-4 rounded-xl bg-white/95 backdrop-blur-md shadow-xl p-4 max-h-[calc(100vh-120px)] overflow-y-auto">
          <Link
            href="/app/marketplace"
            onClick={() => setOpen(false)}
            className="block w-full text-left px-4 py-3 rounded-lg btn-primary"
          >
            Marketplace
          </Link>
          <Link
            href="/app/animals"
            onClick={() => setOpen(false)}
            className="mt-2 block w-full text-left px-4 py-3 rounded-lg btn-primary"
          >
            Animals
          </Link>
          <Link
            href="/app/breeders"
            onClick={() => setOpen(false)}
            className="mt-2 block w-full text-left px-4 py-3 rounded-lg btn-primary"
          >
            Breeders
          </Link>
          <Link
            href="/app/reels"
            onClick={() => setOpen(false)}
            className="mt-2 block w-full text-left px-4 py-3 rounded-lg btn-primary"
          >
            Reels
          </Link>
          {showProfile ? (
            <>
              <Link
                href="/app"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center gap-3 px-4 py-3 rounded-lg text-[var(--color-deep-navy)] font-medium hover:bg-[var(--metallic-silver)] transition"
              >
                <span className="relative h-9 w-9 overflow-hidden rounded-full bg-[var(--color-deep-navy)]/10 text-sm font-semibold text-[var(--color-deep-navy)] flex items-center justify-center">
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
              </Link>
              <button
                onClick={async () => {
                  await logout();
                  setOpen(false);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg btn-primary px-4 py-3 text-left text-sm font-semibold transition hover:opacity-90"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M15 3H6a2 2 0 00-2 2v14a2 2 0 002 2h9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 17l5-5-5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 12h-9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              onClick={() => setOpen(false)}
              className="mt-2 block w-full text-left px-4 py-3 rounded-lg btn-primary"
            >
              Create account
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
