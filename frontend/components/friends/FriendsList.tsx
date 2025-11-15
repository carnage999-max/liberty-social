"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import type { Friend } from "@/lib/types";
import Image from "next/image";

export default function FriendsList() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const {
    items: friendsItems,
    loading: friendsLoading,
  } = usePaginatedResource<Friend>("/auth/friends/", {
    enabled: !!accessToken,
    query: { page_size: 50 },
  });

  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    container?.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      container?.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  useEffect(() => {
    checkScroll();
  }, [friendsItems]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 300;
    const newScrollLeft =
      scrollContainerRef.current.scrollLeft +
      (direction === "left" ? -scrollAmount : scrollAmount);
    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  if (friendsLoading) {
    return (
      <div className="rounded-[16px] bg-white/85 p-4 shadow-sm backdrop-blur-md">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Friends</h3>
        <div className="flex gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-gray-200 animate-pulse"></div>
              <div className="h-2 w-12 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!friendsItems || friendsItems.length === 0) {
    return (
      <div className="rounded-[16px] bg-white/85 p-4 text-center shadow-sm backdrop-blur-md">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Friends</h3>
        <p className="text-sm text-gray-500">No friends yet. Add some friends to see them here!</p>
      </div>
    );
  }

  return (
    <div className="rounded-[16px] bg-white/85 p-4 shadow-sm backdrop-blur-md">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">Friends</h3>
      
      <div className="relative">
        {/* Scroll buttons */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-(--color-deep-navy) shadow-md transition hover:bg-(--color-deeper-navy) active:scale-95 border border-(--color-gold) text-(--color-primary)"
            aria-label="Scroll left"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 19l-7-7 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-(--color-deep-navy) shadow-md transition hover:bg-(--color-deeper-navy) active:scale-95 border border-(--color-gold) text-(--color-primary)"
            aria-label="Scroll right"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none]"
          style={{
            paddingLeft: canScrollLeft ? "2rem" : "0",
            paddingRight: canScrollRight ? "2rem" : "0",
          }}
        >
          {friendsItems.map((friend) => (
            <button
              key={friend.id}
              onClick={() => router.push(`/app/users/${friend.friend.id}`)}
              className="group flex flex-shrink-0 flex-col items-center gap-2 transition"
            >
              <div className="relative h-14 w-14 overflow-hidden rounded-full ring-2 ring-transparent transition group-hover:ring-[var(--color-deep-navy)]">
                <Image
                  src={friend.friend.profile_image_url || "/images/default-avatar.png"}
                  alt={friend.friend.username || "friend"}
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="max-w-[70px] text-center text-xs font-medium text-gray-700 truncate group-hover:text-[var(--color-deep-navy)]">
                {friend.friend.username ||
                  (friend.friend.email ? friend.friend.email.split("@")[0] : "Friend")}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
