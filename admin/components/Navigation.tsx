"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

  const navItems: Array<{ href: string; label: string }> = [
    { href: "/", label: "Dashboard" },
    { href: "/kyc", label: "KYC Submissions" },
    { href: "/moderation", label: "Moderation" },
    { href: "/admin-logs", label: "Admin Logs" },
    { href: "/security", label: "Security" },
  ];

  return (
    <nav className="admin-nav">
      <div className="admin-nav__container">
        <div className="admin-nav__brand">
          <span className="admin-nav__eyebrow">Liberty Social</span>
          <span className="admin-nav__title">Admin Console</span>
        </div>
        <div className="admin-nav__links">
          {navItems.map((item: { href: string; label: string }) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={`admin-nav__link ${isActive ? "admin-nav__link--active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
