const URL_REGEX = /\b((https?:\/\/|www\.)[^\s<]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi;
const TRAILING_PUNCT = new Set([")", "]", "}", ".", ",", "!", "?", ":", ";", "\"", "'"]);

export type LinkSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

function trimTrailingPunct(value: string): { trimmed: string; trailing: string } {
  let end = value.length;
  while (end > 0 && TRAILING_PUNCT.has(value[end - 1])) {
    end -= 1;
  }
  return { trimmed: value.slice(0, end), trailing: value.slice(end) };
}

function toHref(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}

export function parseTextWithLinks(text: string): LinkSegment[] {
  if (!text) return [{ type: "text", value: "" }];

  const segments: LinkSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_REGEX)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, index) });
    }
    const previousChar = index > 0 ? text[index - 1] : "";
    const isBareDomain = !raw.startsWith("http://") && !raw.startsWith("https://") && !raw.startsWith("www.");
    if (isBareDomain && (previousChar === "@" || /\w/.test(previousChar))) {
      segments.push({ type: "text", value: raw });
      lastIndex = index + raw.length;
      continue;
    }
    const { trimmed, trailing } = trimTrailingPunct(raw);
    if (trimmed) {
      segments.push({ type: "link", value: trimmed, href: toHref(trimmed) });
    }
    if (trailing) {
      segments.push({ type: "text", value: trailing });
    }
    lastIndex = index + raw.length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

export function extractFirstUrl(text: string): string | null {
  for (const match of text.matchAll(URL_REGEX)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const previousChar = index > 0 ? text[index - 1] : "";
    const isBareDomain = !raw.startsWith("http://") && !raw.startsWith("https://") && !raw.startsWith("www.");
    if (isBareDomain && (previousChar === "@" || /\w/.test(previousChar))) {
      continue;
    }
    const { trimmed } = trimTrailingPunct(raw);
    if (trimmed) {
      return toHref(trimmed);
    }
  }
  return null;
}
