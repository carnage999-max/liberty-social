"use client";

import { FeatureAnnouncement } from "@/components/modals/FeatureAnnouncementModal";

// Define all feature announcements
export const FEATURE_ANNOUNCEMENTS: FeatureAnnouncement[] = [
  {
    id: "passkeys",
    title: "Introducing Passkeys",
    description:
      "Sign in faster and more securely with passkeys! No passwords needed - just use your device's biometric authentication or PIN.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    guide: {
      steps: [
        {
          title: "Go to Settings",
          description: "Navigate to your account settings page where you can manage your security options.",
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
            </svg>
          ),
        },
        {
          title: "Enable Passkey",
          description: "Click 'Enable Passkey' and choose a nickname for your device (e.g., 'My iPhone' or 'Work Laptop').",
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ),
        },
        {
          title: "Authenticate",
          description: "Use your device's biometric authentication (fingerprint, face ID) or PIN to create your passkey.",
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" />
              <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" />
              <path d="M12 21c0-1-1-3-3-3s-3 2-3 3 2 3 3 3 3-2 3-3" />
              <path d="M12 3c0 1-1 3-3 3S6 5 6 4s2-3 3-3 3 2 3 3" />
            </svg>
          ),
        },
        {
          title: "Sign In with Passkey",
          description: "Next time you sign in, click 'Sign in with Passkey' and use your device authentication - no password needed!",
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          ),
        },
      ],
    },
    actionLink: "/app/settings",
    actionText: "Enable Passkey Now",
    badge: "New",
  },
  // Example: Add more feature announcements here
  // They will be shown in order, one at a time, after the previous one is dismissed
  // {
  //   id: "dark-mode",
  //   title: "Dark Mode Available",
  //   description: "Switch to dark mode for a more comfortable viewing experience, especially in low-light conditions.",
  //   icon: (
  //     <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  //       <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  //     </svg>
  //   ),
  //   guide: {
  //     steps: [
  //       {
  //         title: "Open Settings",
  //         description: "Go to your account settings page.",
  //       },
  //       {
  //         title: "Toggle Dark Mode",
  //         description: "Find the appearance section and toggle dark mode on.",
  //       },
  //     ],
  //   },
  //   actionLink: "/app/settings",
  //   actionText: "Try Dark Mode",
  //   badge: "New",
  // },
];

