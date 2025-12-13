"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import AppShell from "@/components/layout/AppShell";
import { CallProvider } from "@/contexts/CallContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <CallProvider>
        <AppShell>{children}</AppShell>
      </CallProvider>
    </RequireAuth>
  );
}

