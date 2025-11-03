"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function NotFound() {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-white safe-pt safe-px safe-pb">
      <div className="mx-auto max-w-2xl text-center">
        <div className="animate-fade-in">
          {/* 404 with gradient animation */}
          <h1 className="text-8xl font-black mb-4 animated-gradient-text">404</h1>
          
          {/* Main heading */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Page not found
          </h2>
          
          {/* Description */}
          <p className="text-gray-600 mb-8">
            Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
          </p>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link
                href="/app/feed"
                className="inline-block bg-linear-to-r from-(--color-primary) to-(--color-secondary)
                         text-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition shadow-metallic"
              >
                Return to Feed
              </Link>
            ) : (
              <Link
                href="/"
                className="inline-block bg-linear-to-r from-(--color-primary) to-(--color-secondary)
                         text-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition shadow-metallic"
              >
                Return Home
              </Link>
            )}
            
            <Link
              href={isAuthenticated ? "/app" : "/auth"}
              className="inline-block bg-white text-(--color-primary) font-semibold px-8 py-3 rounded-xl
                       hover:opacity-90 transition shadow-md border border-gray-100"
            >
              {isAuthenticated ? "Go to Dashboard" : "Sign In"}
            </Link>
          </div>
        </div>

        {/* Decorative ripple effect */}
        <div className="ripple-layer" aria-hidden="true">
          <div className="ripple" style={{ left: "50%", top: "30%" }} />
          <div className="ripple" style={{ left: "25%", top: "60%", animationDelay: "300ms" }} />
          <div className="ripple" style={{ left: "75%", top: "45%", animationDelay: "600ms" }} />
        </div>
      </div>
    </div>
  );
}