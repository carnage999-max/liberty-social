"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/" as const, label: "Dashboard" },
    { href: "/kyc" as const, label: "KYC Submissions" },
    { href: "/admin-logs" as const, label: "Admin Logs" },
    { href: "/security" as const, label: "Security" },
  ];

  return (
    <nav className="admin-nav">
      <div className="admin-nav__container">
        <div className="admin-nav__brand">
          <span className="admin-nav__eyebrow">Liberty Social</span>
          <span className="admin-nav__title">Admin Console</span>
        </div>
        <div className="admin-nav__links">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
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

