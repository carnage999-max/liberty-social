import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export const runtime = "nodejs";

const MAX_HTML_BYTES = 1_000_000;
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "127.0.0.1"]);

function isPrivateIp(address: string): boolean {
  if (address === "::1") return true;
  if (address.startsWith("fc") || address.startsWith("fd")) return true;
  if (address.startsWith("fe80")) return true;

  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 0) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

async function isBlockedHost(hostname: string): Promise<boolean> {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".localhost")) return true;

  if (isIP(hostname)) {
    return isPrivateIp(hostname);
  }

  try {
    const results = await lookup(hostname, { all: true });
    return results.some((result) => isPrivateIp(result.address));
  } catch {
    return true;
  }
}

function cleanText(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned.slice(0, 300) : null;
}

function findMetaContent(html: string, key: string): string | null {
  const metaTagRegex = /<meta[^>]*>/gi;
  const keyLower = key.toLowerCase();
  const tags = html.match(metaTagRegex) || [];
  for (const tag of tags) {
    const property = tag.match(/\sproperty=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const name = tag.match(/\sname=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (property !== keyLower && name !== keyLower) continue;
    const content = tag.match(/\scontent=["']([^"']+)["']/i)?.[1];
    if (content) return content;
  }
  return null;
}

function findTitleTag(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1] ?? null;
}

function resolveUrl(base: string, value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("data:")) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

async function readHtmlWithLimit(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_HTML_BYTES) {
    throw new Error("Response too large");
  }

  if (!response.body) {
    return await response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > MAX_HTML_BYTES) {
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8").decode(buffer);
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const normalized = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
    ? rawUrl
    : `https://${rawUrl}`;

  let targetUrl: URL;
  try {
    targetUrl = new URL(normalized);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
  }

  if (await isBlockedHost(targetUrl.hostname)) {
    return NextResponse.json({ error: "Blocked host" }, { status: 400 });
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      redirect: "follow",
      headers: {
        "user-agent": "LibertySocialLinkPreview/1.0",
        "accept": "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ error: "Unsupported content" }, { status: 400 });
    }

    const html = await readHtmlWithLimit(response);
    const title =
      findMetaContent(html, "og:title") ||
      findMetaContent(html, "twitter:title") ||
      findTitleTag(html);
    const description =
      findMetaContent(html, "og:description") ||
      findMetaContent(html, "twitter:description") ||
      findMetaContent(html, "description");
    const image =
      findMetaContent(html, "og:image") ||
      findMetaContent(html, "twitter:image");
    const siteName =
      findMetaContent(html, "og:site_name") ||
      findMetaContent(html, "twitter:site") ||
      targetUrl.hostname;

    const payload = {
      url: targetUrl.toString(),
      title: cleanText(title),
      description: cleanText(description),
      image: resolveUrl(targetUrl.toString(), cleanText(image)),
      siteName: cleanText(siteName),
    };

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Preview failed" }, { status: 502 });
  }
}
