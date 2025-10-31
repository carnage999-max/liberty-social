"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Spinner from "@/components/Spinner";

export default function PublicOnly({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hydrated, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated || loading) return;
    if (isAuthenticated) router.replace("/app");
  }, [hydrated, loading, isAuthenticated, router]);

  if (!hydrated || loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Spinner />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return <>{children}</>;
}
