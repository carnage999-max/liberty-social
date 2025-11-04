"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function AppHome() {
  const { user } = useAuth();
  const needsProfileDetails = !user?.first_name || !user?.last_name || !user?.bio;

  const cards = [
    {
      title: needsProfileDetails ? "Complete your profile" : "Review your profile",
      description: needsProfileDetails
        ? "Add a few personal details so friends can recognise you faster."
        : "Everything up to date? Give your profile a quick refresh.",
      href: "/app/settings",
      accent: "from-yellow-400/80 to-orange-500/80",
      linkLabel: needsProfileDetails ? "Update profile" : "Manage profile",
    },
    {
      title: "Catch up on your feed",
      description: "See what your friends and communities have shared since your last visit.",
      href: "/app/feed",
      accent: "from-sky-400/80 to-indigo-500/80",
      linkLabel: "Go to feed",
    },
    {
      title: "Privacy at a glance",
      description: "Decide who can view your profile and friend list with a quick settings check.",
      href: "/app/settings",
      accent: "from-emerald-400/80 to-teal-500/80",
      linkLabel: "Adjust privacy",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[18px] border border-gray-100 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
        <p className="mt-2 text-sm text-gray-600">
          Use the navigation on the left to dive into your feed, manage friends, review notifications,
          or fine-tune your settings. New features are landing soon!
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group relative overflow-hidden rounded-[18px] border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.accent}`}
            />
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
              <p className="text-sm text-gray-600">{card.description}</p>
            </div>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-(--color-deep-navy) transition group-hover:gap-3">
              {card.linkLabel}
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M13 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
