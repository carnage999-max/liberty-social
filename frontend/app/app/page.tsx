export const metadata = {
  title: "Home",
  description: "Your Liberty Social home",
};

export default function AppHome() {
  return (
    <div className="space-y-6">
      <section className="rounded-[18px] border border-gray-100 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
        <p className="mt-2 text-sm text-gray-600">
          Use the navigation on the left to dive into your feed, manage friends, review notifications,
          or fine-tune your settings. New features are landing soon!
        </p>
      </section>
    </div>
  );
}
