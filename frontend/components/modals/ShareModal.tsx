"use client";

import { useState } from "react";
import { useToast } from "@/hooks/useToast";

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
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast("Link copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast("Failed to copy link", "error");
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
      icon: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-4.255.949c-1.168.505-2.231 1.227-3.045 2.059-1.604 1.614-2.48 3.791-2.48 6.029 0 1.775.366 3.482 1.069 5.064l-1.136 3.259 3.541-1.137c1.465.823 3.148 1.247 4.842 1.247h.004c5.442 0 9.886-4.418 9.886-9.835C21.15 7.817 16.708 3.321 11.266 3.321 6.826 3.321 2.436 7.817 2.436 13.256c0 2.052.493 4.02 1.43 5.778l-1.519 4.355 4.603-1.47c1.577.923 3.379 1.411 5.278 1.411 5.442 0 9.886-4.418 9.886-9.835 0-5.417-4.444-9.833-9.886-9.833",
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
