'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ANNOUNCEMENT_STORAGE_KEY = 'liberty-app-announcement-v1.0.4';

export function AppAnnouncement() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Check if user previously dismissed this announcement
    const isDismissed = localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY) === 'true';
    setIsVisible(!isDismissed);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, 'true');
  };

  // Prevent hydration mismatch
  if (!isMounted || !isVisible) return null;

  return (
    <div
      className="w-full bg-gradient-to-r from-[#a8862a] via-[#d7b756] to-[#a8862a] py-4 px-6 flex items-center justify-between gap-4"
      style={{
        boxShadow: '0 4px 12px rgba(200, 162, 95, 0.3)',
      }}
    >
      <div className="flex-1">
        <p className="text-[#0B3D91] font-semibold text-center">
          Download Liberty Social on Google Play for the full experience with voice & video calls.
        </p>
      </div>
      <a
        href="https://play.google.com/store/apps/details?id=com.libertysocial.app"
        target="_blank"
        rel="noopener noreferrer"
        className="whitespace-nowrap font-semibold px-4 py-2 rounded-lg transition-all"
        style={{
          background: 'linear-gradient(135deg, #192A4A 0%, #2a4280 100%)',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(200, 162, 95, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          border: '1px solid #C8A25F',
        }}
      >
        Get App
      </a>
      <button
        onClick={handleClose}
        className="text-[#0B3D91] hover:opacity-70 transition-opacity"
        aria-label="Close announcement"
      >
        <X size={20} />
      </button>
    </div>
  );
}
