"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/auth?next=${next}`);
    }
  }, [userId, loading, pathname, router]);

  if (loading || !userId) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-pulse text-gray-500">Loading…</div>
      </div>
    );
  }
  return <>{children}</>;
}
