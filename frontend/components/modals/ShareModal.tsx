"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  title?: string;
  type?: "post" | "profile" | "page";
}

export default function ShareModal({
  isOpen,
  onClose,
  shareUrl,
  title = "Share",
  type = "post",
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.show("Link copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.show("Failed to copy link", "error");
    }
  };

  const shareLinks = {
    facebook: {
      name: "Facebook",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      icon: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    },
    twitter: {
      name: "Twitter",
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`,
      icon: "M23.953 4.57a10 10 0 002.856-3.515 10 10 0 01-2.836.756 4.958 4.958 0 002.165-2.573c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z",
    },
    linkedin: {
      name: "LinkedIn",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      icon: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z",
    },
    whatsapp: {
      name: "WhatsApp",
      url: `https://wa.me/?text=${encodeURIComponent(title + " " + shareUrl)}`,
      icon: "M20.52 3.48C18.25 1.23 15.31 0 12 0 5.46 0 0.13 5.33 0.13 11.88c0 2.18.56 4.32 1.65 6.21L0 24l6.5-1.7c1.82.99 3.87 1.52 6.02 1.52 6.56 0 11.89-5.33 11.89-11.89 0-3.17-1.23-6.15-3.48-8.38zM12 21.77c-1.89 0-3.74-.51-5.36-1.46l-.38-.23-3.98 1.05.84-3.12-.25-.38C2.66 15.5 2.1 13.73 2.1 11.88 2.1 6.64 6.34 2.4 11.58 2.4c2.76 0 5.35 1.07 7.3 3.03 1.95 1.95 3.03 4.54 3.03 7.3-.01 5.23-4.25 9.47-9.49 9.47zm5.15-7.05c-.28-.14-1.66-.82-1.92-.91-.26-.09-.45-.14-.64.14-.19.28-.73.92-.89 1.11-.16.19-.33.21-.61.07-.28-.14-1.19-.44-2.27-1.4-.84-.79-1.41-1.68-1.57-1.96-.16-.28-.02-.44.12-.58.12-.12.28-.33.42-.49.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.63-1.53-.87-2.1-.23-.55-.46-.48-.64-.48-.16 0-.35-.02-.54-.02-.19 0-.49.07-.75.35-.26.28-.99.97-.99 2.36 0 1.39 1.01 2.74 1.15 2.93.14.19 1.99 3.05 4.83 4.27.68.29 1.2.46 1.61.59.68.22 1.3.19 1.79.11.55-.08 1.68-.69 1.91-1.35.23-.66.23-1.23.16-1.35-.07-.12-.26-.19-.53-.33z",
    },
    telegram: {
      name: "Telegram",
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`,
      icon: "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.487-1.302.487-.428 0-1.255-.241-1.888-.424-.764-.168-1.368-.27-1.315-.893.027-.164.157-.334.408-.437l.616-.231c.386-.12 2.758-1.133 3.258-1.584.5-.45.966-.4 1.414-.192.45.21 2.676 1.483 3.141 1.71.24.134.487.181.649.181.165 0 .36-.049.53-.144 1.689-.963 2.242-6.844 2.242-6.844z",
    },
  };

  const handleShareTo = (platform: keyof typeof shareLinks) => {
    const link = shareLinks[platform].url;
    window.open(link, "_blank", "width=600,height=400");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-[16px] border-2 p-6"
          style={{
            backgroundColor: "var(--color-deep-navy)",
            borderColor: "var(--color-gold)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--color-gold)" }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10"
              aria-label="Close modal"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Copy Link Section */}
          <div className="mb-6">
            <label
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Copy Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 rounded-[8px] border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 backdrop-blur-sm"
                style={{ borderColor: "var(--color-gold)" }}
              />
              <button
                onClick={handleCopyLink}
                className="rounded-[8px] px-4 py-2 font-medium transition"
                style={{
                  backgroundColor: copied ? "var(--color-gold)" : "var(--color-deep-navy)",
                  color: copied ? "var(--color-deep-navy)" : "var(--color-gold)",
                  border: `2px solid var(--color-gold)`,
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Share To Section */}
          <div>
            <label className="mb-3 block text-sm font-medium text-white/80">
              Share To
            </label>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(shareLinks).map(([platform, { name, icon }]) => (
                <button
                  key={platform}
                  onClick={() => handleShareTo(platform as keyof typeof shareLinks)}
                  className="group flex flex-col items-center gap-2 rounded-[12px] border border-white/20 px-3 py-3 transition hover:border-white/40 hover:bg-white/5"
                  title={name}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="transition group-hover:scale-110"
                    style={{ color: "var(--color-gold)" }}
                  >
                    <path d={icon} />
                  </svg>
                  <span className="text-xs font-medium text-white/70 group-hover:text-white/90">
                    {name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="mt-6 w-full rounded-[8px] py-2 font-medium transition"
            style={{
              backgroundColor: "var(--color-deep-navy)",
              color: "var(--color-gold)",
              border: `2px solid var(--color-gold)`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-gold)";
              e.currentTarget.style.color = "var(--color-deep-navy)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-deep-navy)";
              e.currentTarget.style.color = "var(--color-gold)";
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
