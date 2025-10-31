export const dynamic = "force-dynamic";

import AuthPanel from "@/components/auth/AuthPanel";
import PublicOnly from "@/components/auth/PublicOnly";
import Navbar from "@/components/navbar";
import { Suspense } from "react";

export const metadata = {
  title: "Sign in or Sign up",
  description: "Access Liberty Social",
};

export default function AuthPage() {
  return (
    <>
      <Navbar />
      <section className="safe-pt safe-px safe-pb pt-28 md:pt-36 pb-20">
        <div className="max-w-6xl mx-auto">
          <h1 className="sr-only">Authentication</h1>
          <PublicOnly>
          <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading...</div>}>
          <AuthPanel />
          </Suspense>
          </PublicOnly>
        </div>
      </section>
    </>
  );
}
