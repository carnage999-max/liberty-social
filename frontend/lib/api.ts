// lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

type Options = {
  headers?: Record<string, string>;
  token?: string | null;
  next?: RequestInit["next"];
  cache?: RequestInit["cache"];
  signal?: AbortSignal;
};

function withAuthHeaders(opts: Options = {}) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (opts.token) h.Authorization = `Bearer ${opts.token}`;
  return h;
}

export async function apiPost(
  path: string,
  body?: unknown,
  opts: Options = {}
) {
  const url = `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: withAuthHeaders(opts),
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    next: opts.next,
    cache: opts.cache,
    signal: opts.signal,
  });
  if (!res.ok) throw await toApiError(res);
  return safeJson(res);
}

export async function apiGet<T = any>(
  path: string,
  opts: Options = {}
): Promise<T> {
  const url = `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: withAuthHeaders(opts),
    credentials: "include",
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
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (data?.detail) message = String(data.detail);
    if (data?.message) message = String(data.message);
  } catch {}
  const err = new Error(message) as Error & { status?: number };
  err.status = res.status;
  return err;
}
