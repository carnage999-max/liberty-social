"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import Link from "next/link";

export default function ReelsPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--color-rich-red-top)] via-[var(--color-rich-red-bottom)] to-[var(--color-deep-navy)] px-4 relative overflow-hidden">
        <div className="max-w-2xl w-full text-center space-y-8 relative z-10">
          {/* Animated Icon/Logo */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-[var(--color-gold)] rounded-full blur-2xl opacity-50 animate-pulse" />
              <div className="relative bg-white/10 backdrop-blur-md rounded-full p-8 border-4 border-[var(--color-gold)]">
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white"
                >
                  <path
                    d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="currentColor"
                    fillOpacity="0.2"
                  />
                  <path
                    d="M9 12l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-extrabold text-white drop-shadow-lg">
              Reels
            </h1>
            <div className="h-1 w-32 bg-[var(--color-gold)] mx-auto rounded-full" />
          </div>

          {/* Message */}
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Coming Soon!
            </h2>
            <p className="text-xl md:text-2xl text-white/90 leading-relaxed">
              We're working hard to bring you an amazing short-form video experience.
              <br />
              <span className="text-lg text-white/80">
                Stay tuned for updates!
              </span>
            </p>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
            {[
              { icon: "🎬", title: "Short Videos", desc: "Create & share" },
              { icon: "🔥", title: "Trending", desc: "Discover content" },
              { icon: "❤️", title: "Engage", desc: "Like & comment" },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-white/10 backdrop-blur-md rounded-xl p-6 border-2 border-white/20 hover:border-[var(--color-gold)] transition-all duration-300"
              >
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/80">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Back Button */}
          <div className="pt-8">
            <Link
              href="/app/feed"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white font-semibold transition-all duration-300 border-2 border-white/30 hover:border-[var(--color-gold)]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to Feed
            </Link>
          </div>

          {/* Decorative Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-10 w-32 h-32 bg-[var(--color-gold)]/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-20 right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}

