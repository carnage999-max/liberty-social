import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./navbar";

export const metadata: Metadata = {
  title: "Liberty Social",
  description: "A new kind of social experience — coming soon.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Inter font for a clean, modern UI (good for dense interfaces) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background text-textLight transition-colors duration-300 antialiased">
        <Navbar />
        <main>{children}</main>
        <footer className="mt-16 border-t border-gray-200">
          <div className="max-w-6xl mx-auto py-8 px-6 flex flex-col md:flex-row items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Liberty Social logo" width={36} height={36} className="rounded-full" />
              <div>
                <div className="text-sm font-semibold text-primary">Liberty Social</div>
                <div className="text-xs text-gray-500">Coming soon — built for connection</div>
              </div>
            </div>

            <nav className="flex gap-6" aria-label="Footer">
              <a href="#" className="text-sm text-gray-600 gradient-underline">About</a>
              <a href="#" className="text-sm text-gray-600 gradient-underline">Privacy</a>
              <a href="#" className="text-sm text-gray-600 gradient-underline">Terms</a>
            </nav>

            <div className="flex items-center gap-4">
              <a href="#" className="text-gray-600 hover:text-primary" aria-label="Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22 5.92c-.66.29-1.37.49-2.12.58.76-.45 1.34-1.17 1.61-2.03-.71.42-1.5.73-2.34.9A3.52 3.52 0 0015.5 4c-1.95 0-3.53 1.6-3.53 3.57 0 .28.03.55.09.81-2.93-.15-5.53-1.56-7.27-3.71-.3.5-.47 1.08-.47 1.7 0 1.17.59 2.2 1.5 2.8-.55-.02-1.07-.17-1.52-.42v.04c0 1.64 1.14 3.01 2.65 3.33-.28.08-.57.12-.87.12-.21 0-.42-.02-.62-.06.42 1.31 1.63 2.27 3.07 2.3A7.07 7.07 0 013 19.54a9.98 9.98 0 005.4 1.58c6.48 0 10.03-5.4 10.03-10.08v-.46c.7-.5 1.3-1.12 1.79-1.83-.64.29-1.32.48-2.03.57z"/></svg>
              </a>
              <a href="#" className="text-gray-600 hover:text-primary" aria-label="GitHub">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a12 12 0 00-3.79 23.4c.6.1.82-.26.82-.58v-2.02c-3.34.72-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.1-.76.08-.75.08-.75 1.22.09 1.86 1.27 1.86 1.27 1.08 1.85 2.83 1.32 3.52 1.01.11-.79.42-1.32.76-1.62-2.66-.31-5.46-1.34-5.46-5.95 0-1.32.47-2.4 1.24-3.25-.12-.31-.54-1.56.12-3.25 0 0 1.01-.33 3.3 1.24a11.5 11.5 0 016 0c2.28-1.57 3.29-1.24 3.29-1.24.66 1.69.24 2.94.12 3.25.78.85 1.24 1.93 1.24 3.25 0 4.62-2.8 5.64-5.47 5.94.43.37.8 1.1.8 2.22v3.29c0 .32.22.69.83.57A12 12 0 0012 .5z"/></svg>
              </a>
            </div>
          </div>

          <div className="text-center text-sm text-gray-400 py-4">© {new Date().getFullYear()} Liberty Social. All rights reserved.</div>
        </footer>
      </body>
    </html>
  );
}
