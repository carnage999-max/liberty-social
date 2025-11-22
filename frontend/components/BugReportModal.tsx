"use client";

import { useState, useRef } from "react";

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function BugReportModal({ open, onClose }: BugReportModalProps) {
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const formData = new FormData();
    formData.append("message", message);
    if (screenshot) formData.append("screenshot", screenshot);

    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${base.replace(/\/+$/, "")}/feedback/`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setSent(true);
        setMessage("");
        setScreenshot(null);
        setTimeout(() => {
          onClose();
          setSent(false);
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to send feedback", err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/95 rounded-2xl shadow-metallic p-6 w-full max-w-md relative">
        <button
          className="absolute top-3 right-3 text-(--color-deeper-navy) hover:text-(--color-deeper-navy)/80"
          onClick={() => {
            onClose();
            setSent(false);
            setMessage("");
            setScreenshot(null);
          }}
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold mb-3 text-(--color-deeper-navy)">Report a Bug</h2>

        {sent ? (
          <p className="text-(--color-deeper-navy)">✅ Thank you! Your report has been sent.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <textarea
              className="w-full resize-none rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-(--color-deeper-navy) outline-none transition focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
              placeholder="Describe the issue..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-(--color-deeper-navy) transition hover:bg-gray-100"
              >
                <span role="img" aria-hidden>
                  🖼️
                </span>
                Add screenshot
              </button>
              {screenshot && (
                <span className="text-xs text-gray-500">{screenshot.name}</span>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <button
                type="submit"
                className="btn-primary"
                disabled={sending}
              >
                {sending ? "Sending..." : "Send Report"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  onClose();
                  setSent(false);
                  setMessage("");
                  setScreenshot(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

