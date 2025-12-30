'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface NotificationBarProps {
  message: string;
  duration?: number; // in milliseconds, 0 = never auto-dismiss
  onDismiss?: () => void;
}

export function NotificationBar({
  message,
  duration = 5000,
  onDismiss,
}: NotificationBarProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration === 0) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!isVisible) return null;

  const handleClose = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div
      className="w-full bg-gradient-to-r from-[#a8862a] via-[#d7b756] to-[#a8862a] py-3 px-6 flex items-center justify-between gap-4"
      style={{
        boxShadow: '0 4px 12px rgba(200, 162, 95, 0.3)',
      }}
    >
      <p className="text-[#0B3D91] font-semibold text-center flex-1">
        {message}
      </p>
      <button
        onClick={handleClose}
        className="text-[#0B3D91] hover:opacity-70 transition-opacity flex-shrink-0"
        aria-label="Close notification"
      >
        <X size={20} />
      </button>
    </div>
  );
}
