"use client";

import { useEffect, useState } from "react";

type LinkPreview = {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
};

const previewCache = new Map<string, LinkPreview | null>();

export default function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = previewCache.get(url);
    if (cached !== undefined) {
      setPreview(cached);
      return () => {
        cancelled = true;
      };
    }

    const loadPreview = async () => {
      try {
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
          previewCache.set(url, null);
          if (!cancelled) setPreview(null);
          return;
        }
        const data = (await response.json()) as LinkPreview;
        const normalized = data?.title || data?.description || data?.image ? data : null;
        previewCache.set(url, normalized);
        if (!cancelled) setPreview(normalized);
      } catch {
        previewCache.set(url, null);
        if (!cancelled) setPreview(null);
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!preview) return null;

  return (
    <a
      href={preview.url || url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md"
    >
      {preview.image ? (
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <img
            src={preview.image}
            alt={preview.title || preview.siteName || "Link preview"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className="min-w-0">
        {preview.siteName ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {preview.siteName}
          </p>
        ) : null}
        {preview.title ? (
          <p className="text-sm font-semibold text-gray-900 line-clamp-2">{preview.title}</p>
        ) : null}
        {preview.description ? (
          <p className="mt-1 text-xs text-gray-600 line-clamp-2">{preview.description}</p>
        ) : null}
      </div>
    </a>
  );
}
