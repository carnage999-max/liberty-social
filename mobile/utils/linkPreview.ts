type LinkPreviewData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

const URL_REGEX =
  /\b((https?:\/\/|www\.)[^\s/$.?#].[^\s]*)\b|\b([a-z0-9-]+(\.[a-z0-9-]+)+)(\/[^\s]*)?/i;

export const extractFirstUrl = (text?: string | null): string | null => {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  if (!match) return null;
  const raw = match[1] || (match[3] ? `${match[3]}${match[5] || ''}` : undefined);
  if (!raw) return null;
  if (raw.includes('@')) return null;
  if (/^\+?\d[\d\s\-().]{6,}\d$/.test(raw)) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  return `https://${raw}`;
};

const extractMetaContent = (html: string, key: string): string | undefined => {
  const metaRegex = new RegExp(
    `<meta[^>]+(?:property|name)=[\"']${key}[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>`,
    'i'
  );
  const match = html.match(metaRegex);
  return match?.[1];
};

const extractTitle = (html: string): string | undefined => {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1];
};

export const fetchLinkPreview = async (url: string): Promise<LinkPreviewData | null> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0',
      },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = await response.text();
    const title =
      extractMetaContent(html, 'og:title') ||
      extractMetaContent(html, 'twitter:title') ||
      extractTitle(html);
    const description =
      extractMetaContent(html, 'og:description') ||
      extractMetaContent(html, 'twitter:description') ||
      extractMetaContent(html, 'description');
    const image =
      extractMetaContent(html, 'og:image') ||
      extractMetaContent(html, 'twitter:image');
    const siteName = extractMetaContent(html, 'og:site_name');
    if (!title && !description && !image) {
      return null;
    }
    return {
      url,
      title: title?.trim(),
      description: description?.trim(),
      image: image?.trim(),
      siteName: siteName?.trim(),
    };
  } catch (error) {
    return null;
  }
};

export type { LinkPreviewData };
