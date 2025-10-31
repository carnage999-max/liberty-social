import AuthPanel from "@/components/auth/AuthPanel";
import Navbar from "@/components/navbar";

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
          <AuthPanel />
        </div>
      </section>
    </>
  );
}
