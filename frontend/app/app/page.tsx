import RequireAuth from "@/components/auth/RequireAuth";
import ProfileCard from "@/components/profile/ProfileCard";
import Feed from "@/components/feed/Feed";

export const metadata = {
  title: "Home",
  description: "Your Liberty Social home",
};

export default function AppHome() {
  return (
    <RequireAuth>
      <section className="pt-28 md:pt-36 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="lg:order-1 order-2 w-full">
            <ProfileCard />
          </aside>
          <main className="lg:order-2 order-1 w-full rounded-[16px] bg-white/80 backdrop-blur-sm shadow-md p-4 sm:p-6">
            <Feed />
          </main>
        </div>
      </section>
    </RequireAuth>
  );
}
