import type { Metadata, Viewport } from "next";
import Image from "next/image";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Navbar from "../components/navbar";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/Toast";
import { UserStatusProvider } from "@/lib/user-status-provider";
import { PushNotificationInitializer } from "@/components/PushNotificationInitializer";
import { LocationTracker } from "@/components/LocationTracker";
import { AppAnnouncement } from "@/components/AppAnnouncement";
import { MobileAppSuggestion } from "@/components/MobileAppSuggestion";


export const metadata: Metadata = {
  metadataBase: new URL("https://mylibertysocial.com"),
  title: {
    default: "Liberty Social",
    template: "%s · Liberty Social",
  },
  description: "A new kind of social experience.",
  applicationName: "Liberty Social",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "https://mylibertysocial.com",
    siteName: "Liberty Social",
    title: "Liberty Social",
    description: "A new kind of social experience.",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image", // served by app/opengraph-image.tsx
        width: 1200,
        height: 630,
        alt: "Liberty Social",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@", // add your handle if you have one
    creator: "@", // add your handle if you have one
    title: "Liberty Social",
    description: "A new kind of social experience.",
    images: ["/twitter-image"], // served by app/twitter-image.tsx
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  category: "social",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#0B3D91" }],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Inter font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-textLight transition-colors duration-300 antialiased">
        <AuthProvider>
          <UserStatusProvider>
            <PushNotificationInitializer />
            <LocationTracker />
          <ToastProvider>
            <AppAnnouncement />
            <MobileAppSuggestion />
            <Navbar />
            <main className="pb-40 md:pb-20">
              {children}
            </main>

            <footer className="border-t border-gray-200 bg-white mt-8 mb-20 sm:mb-0">
              <div className="max-w-6xl mx-auto py-6 px-6 flex flex-col md:flex-row items-center md:justify-between gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-3">
                  <Image
                    src="/images/logo.png"
                    alt="Liberty Social logo"
                    width={36}
                    height={36}
                    className="rounded-full"
                    style={{ height: 'auto' }}
                    priority
                  />
                  <div>
                    <div className="text-sm font-semibold text-primary">
                      Liberty Social
                    </div>
                  </div>
                </div>

                <nav className="flex gap-4 items-center flex-wrap justify-center md:justify-start" aria-label="Footer">
                  <a
                    href="/about"
                    className="text-sm text-gray-600 gradient-underline"
                  >
                    About
                  </a>
                  <a
                    href="/faq"
                    className="text-sm text-gray-600 gradient-underline"
                  >
                    FAQ
                  </a>
                  <a
                    href="/safety"
                    className="text-sm text-gray-600 gradient-underline"
                  >
                    Safety
                  </a>
                  <a
                    href="/privacy"
                    className="text-sm text-gray-600 gradient-underline"
                  >
                    Privacy
                  </a>
                  <a
                    href="/terms"
                    className="text-sm text-gray-600 gradient-underline"
                  >
                    Terms
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.libertysocial.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#a8862a] via-[#d7b756] to-[#a8862a] text-[#0B3D91] hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap"
                    style={{
                      boxShadow: '0 2px 8px rgba(200, 162, 95, 0.2)',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="animate-bounce"
                      style={{ animationDuration: '2s' }}
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </a>
                </nav>

                <div className="text-xs text-gray-400">
                  © {new Date().getFullYear()} Liberty Social. All rights reserved.
                </div>
              </div>
            </footer>
          </ToastProvider>
          </UserStatusProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
