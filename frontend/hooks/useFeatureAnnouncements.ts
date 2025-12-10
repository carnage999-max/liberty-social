"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { FeatureAnnouncement } from "@/components/modals/FeatureAnnouncementModal";
import { FEATURE_ANNOUNCEMENTS } from "@/config/featureAnnouncements";

const STORAGE_KEY = "liberty_feature_announcements_v1";

export function useFeatureAnnouncements() {
  const { isAuthenticated, user } = useAuth();
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const [currentAnnouncement, setCurrentAnnouncement] = useState<FeatureAnnouncement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Load dismissed announcements from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setDismissedAnnouncements(new Set(data.dismissed || []));
      }
    } catch (err) {
      console.error("Error loading dismissed announcements:", err);
    }
  }, []);

  // Check for announcements to show when user becomes authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsOpen(false);
      setCurrentAnnouncement(null);
      return;
    }

    // Find the first announcement that hasn't been dismissed
    const announcementToShow = FEATURE_ANNOUNCEMENTS.find(
      (announcement) => !dismissedAnnouncements.has(announcement.id)
    );

    if (announcementToShow) {
      // Small delay to ensure page is loaded
      const timer = setTimeout(() => {
        setCurrentAnnouncement(announcementToShow);
        setIsOpen(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, dismissedAnnouncements]);

  const handleDismiss = (announcementId: string) => {
    const newDismissed = new Set(dismissedAnnouncements);
    newDismissed.add(announcementId);
    setDismissedAnnouncements(newDismissed);

    // Save to localStorage
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          dismissed: Array.from(newDismissed),
          lastUpdated: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.error("Error saving dismissed announcements:", err);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return {
    currentAnnouncement,
    isOpen,
    onClose: handleClose,
    onDismiss: () => {
      if (currentAnnouncement) {
        handleDismiss(currentAnnouncement.id);
      }
      handleClose();
    },
  };
}

