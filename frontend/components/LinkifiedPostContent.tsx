"use client";

import { useMemo } from "react";
import LinkPreviewCard from "@/components/LinkPreviewCard";
import { extractFirstUrl, parseTextWithLinks } from "@/lib/linkify";

type LinkifiedPostContentProps = {
  content: string;
  className?: string;
  showPreview?: boolean;
};

export default function LinkifiedPostContent({
  content,
  className = "",
  showPreview = true,
}: LinkifiedPostContentProps) {
  const segments = useMemo(() => parseTextWithLinks(content), [content]);
  const firstUrl = useMemo(() => extractFirstUrl(content), [content]);

  return (
    <div className="space-y-3">
      <p className={className}>
        {segments.map((segment, index) => {
          if (segment.type === "text") {
            return <span key={`text-${index}`}>{segment.value}</span>;
          }
          return (
            <a
              key={`link-${index}`}
              href={segment.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--color-primary) underline underline-offset-2 break-words"
            >
              {segment.value}
            </a>
          );
        })}
      </p>
      {showPreview && firstUrl ? <LinkPreviewCard url={firstUrl} /> : null}
    </div>
  );
}
