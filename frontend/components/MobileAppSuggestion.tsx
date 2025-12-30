'use client';

import { useEffect, useState } from 'react';

export function MobileAppSuggestion() {
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());
    setIsMobile(isMobileDevice);
    setIsVisible(isMobileDevice);
  }, []);

  if (!isMobile || !isVisible) return null;

  const handleOpenApp = () => {
    // Try to open via deep link
    const deepLinkUrl = 'liberty-social://app/feed';
    
    // Set up timeout to fall back to Play Store if app doesn't open
    const fallbackTimer = setTimeout(() => {
      window.location.href = 'https://play.google.com/store/apps/details?id=com.libertysocial.app';
    }, 2500);

    // Try to navigate to deep link
    window.location.href = deepLinkUrl;

    // Clear timeout if user comes back
    return () => clearTimeout(fallbackTimer);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-gradient-to-r from-[#a8862a] via-[#d7b756] to-[#a8862a] rounded-lg p-4 shadow-lg">
      <p className="text-[#0B3D91] font-semibold text-sm mb-3">
        You have Liberty Social installed! Open the app for the full experience.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleOpenApp}
          className="flex-1 px-4 py-2 rounded font-semibold text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #192A4A 0%, #2a4280 100%)',
            boxShadow: '0 4px 12px rgba(200, 162, 95, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            border: '1px solid #C8A25F',
          }}
        >
          Open App
        </button>
        <button
          onClick={() => setIsVisible(false)}
          className="px-4 py-2 rounded font-semibold text-[#0B3D91] bg-white hover:bg-gray-100 transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  );
}
