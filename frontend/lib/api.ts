// lib/api.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

export function resolveRemoteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  // Remove leading slash if present
  const cleanUrl = url.startsWith("/") ? url.slice(1) : url;
  return `${API_BASE.replace("/api", "")}/${cleanUrl}`;
}

type Options = {
  headers?: Record<string, string>;
  token?: string | null;
  next?: RequestInit["next"];
  cache?: RequestInit["cache"];
  signal?: AbortSignal;
};

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/**
 * Get the stored access token from localStorage
 * Uses the same STORAGE_KEY as AuthProvider
 */
function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("liberty_auth_v1");
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.accessToken || null;
  } catch {
    return null;
  }
}

function withAuthHeaders(opts: Options = {}) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  
  // Use provided token or fetch from localStorage
  const token = opts.token || getStoredAccessToken();
  if (token) h.Authorization = `Bearer ${token}`;
  
  return h;
}

export class ApiError extends Error {
  status: number;
  data?: unknown;
  fieldErrors?: Record<string, string[]>;
  nonFieldErrors?: string[];

  constructor(init: {
    message: string;
    status: number;
    data?: unknown;
    fieldErrors?: Record<string, string[]>;
    nonFieldErrors?: string[];
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.data = init.data;
    if (init.fieldErrors) this.fieldErrors = init.fieldErrors;
    if (init.nonFieldErrors) this.nonFieldErrors = init.nonFieldErrors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function apiPost<T = any>(path: string, body?: unknown, opts: Options = {}): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: withAuthHeaders(opts),
    body: body ? JSON.stringify(body) : undefined,
    next: opts.next,
    cache: opts.cache,
    signal: opts.signal,
  });
  if (!res.ok) throw await toApiError(res);
  return safeJson<T>(res);
}

export async function apiGet<T = any>(
  path: string,
  opts: Options = {}
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: withAuthHeaders(opts),
    next: opts.next,
    cache: opts.cache,
    signal: opts.signal,
  });
  if (!res.ok) throw await toApiError(res);
  return safeJson<T>(res);
}

export async function apiGetUrl<T = any>(
  url: string,
  opts: Options = {}
): Promise<T> {
  // Normalize URL to use the same protocol/domain as API_BASE if needed
  let normalizedUrl = url;
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(API_BASE);
    
    // If the pagination URL has a different protocol than our base URL, update it
    if (urlObj.protocol !== baseObj.protocol || urlObj.host !== baseObj.host) {
      // Reconstruct the URL using our base's protocol and host
      normalizedUrl = `${baseObj.protocol}//${baseObj.host}${urlObj.pathname}${urlObj.search}`;
    }
  } catch (e) {
    // If URL parsing fails, use the original URL
    normalizedUrl = url;
  }
  
  const res = await fetch(normalizedUrl, {
    method: "GET",
    headers: withAuthHeaders(opts),
    next: opts.next,
    cache: opts.cache,
    signal: opts.signal,
  });
  if (!res.ok) throw await toApiError(res);
  return safeJson<T>(res);
}

export async function apiDelete(
  path: string,
  opts: Options = {}
): Promise<void> {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: withAuthHeaders(opts),
    next: opts.next,
    cache: opts.cache,
    signal: opts.signal,
  });
  if (!res.ok) throw await toApiError(res);
}

export async function apiPatch<T = any>(
  path: string,
  body?: unknown,
  opts: Options = {}
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: withAuthHeaders(opts),
    body: body ? JSON.stringify(body) : undefined,
    next: opts.next,
    cache: opts.cache,
    signal: opts.signal,
  });
  if (!res.ok) throw await toApiError(res);
  return safeJson<T>(res);
}

async function safeJson<T = any>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return null as unknown as T;
  }
}

async function toApiError(res: Response) {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // ignore JSON parsing issues; payload remains null
  }

  const { message, fieldErrors, nonFieldErrors } = normalizeErrorPayload(payload);
  const fallbackMessage =
    message ||
    (res.status >= 500
      ? "Something went wrong on our side. Please try again later."
      : "We couldn't process your request. Please check your input and try again.");

  // Handle 401 Unauthorized - token is invalid/blacklisted
  if (res.status === 401 && typeof window !== "undefined") {
    // Don't redirect if we're already on the auth page
    const currentPath = window.location.pathname;
    if (currentPath.startsWith("/auth")) {
      // Just clear auth, don't redirect
      try {
        localStorage.removeItem("liberty_auth_v1");
      } catch (e) {
        console.warn("Failed to clear auth from localStorage:", e);
      }
    } else {
      // Clear auth state from localStorage
      try {
        localStorage.removeItem("liberty_auth_v1");
      } catch (e) {
        console.warn("Failed to clear auth from localStorage:", e);
      }

      // Redirect to login page with current path as next parameter
      const fullPath = currentPath + window.location.search;
      const nextParam = encodeURIComponent(fullPath);
      // Use setTimeout to ensure the error is thrown first, then redirect
      setTimeout(() => {
        window.location.href = `/auth?next=${nextParam}`;
      }, 0);
    }
  }

  return new ApiError({
    message: fallbackMessage,
    status: res.status,
    data: payload,
    fieldErrors,
    nonFieldErrors,
  });
}

function normalizeErrorPayload(payload: unknown): {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  nonFieldErrors?: string[];
} {
  if (!payload) return {};

  if (typeof payload === "string") {
    return { message: payload };
  }

  if (Array.isArray(payload)) {
    const messages = payload.map(String);
    return {
      message: messages.join(" "),
      nonFieldErrors: messages,
    };
  }

  if (typeof payload !== "object") return {};

  const data = payload as Record<string, unknown>;
  const fieldErrors: Record<string, string[]> = {};
  const nonFieldErrors = collectMessages(data.non_field_errors ?? data.errors);

  let message =
    pickMessage(data.detail) ??
    pickMessage(data.message) ??
    (nonFieldErrors?.length ? nonFieldErrors.join(" ") : undefined);

  for (const [key, value] of Object.entries(data)) {
    if (["detail", "message", "non_field_errors", "errors"].includes(key)) continue;
    const msgs = collectMessages(value);
    if (msgs?.length) {
      fieldErrors[key] = msgs;
      if (!message) {
        message = msgs[0];
      }
    }
  }

  return {
    message,
    fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
    nonFieldErrors: nonFieldErrors?.length ? nonFieldErrors : undefined,
  };
}

function pickMessage(value: unknown): string | undefined {
  const msgs = collectMessages(value);
  return msgs?.[0];
}

function collectMessages(value: unknown): string[] | undefined {
  if (!value && value !== 0) return undefined;
  if (Array.isArray(value)) {
    const filtered = value.map((v) => String(v)).filter(Boolean);
    return filtered.length ? filtered : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : undefined;
  }
  if (typeof value === "object" && value !== null) {
    const nestedMessages: string[] = [];
    for (const nested of Object.values(value)) {
      const msgs = collectMessages(nested);
      if (msgs) nestedMessages.push(...msgs);
    }
    return nestedMessages.length ? nestedMessages : undefined;
  }
  return [String(value)];
}
