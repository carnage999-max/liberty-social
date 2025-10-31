import RequireAuth from "@/components/auth/RequireAuth";
import ProfileCard from "@/components/profile/ProfileCard";

export const metadata = {
  title: "Home",
  description: "Your Liberty Social home",
};

export default function AppHome() {
  return (
    <RequireAuth>
      <section className="pt-28 md:pt-36 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-[340px,1fr]">
          <aside>
            <ProfileCard />
          </aside>
          <main className="rounded-[16px] bg-white/80 backdrop-blur-sm shadow-md p-4 sm:p-6">
            <h2 className="text-xl font-bold mb-4">Feed</h2>
            <div className="text-gray-600">Your posts and communities will live here.</div>
          </main>
        </div>
      </section>
    </RequireAuth>
  );
}
