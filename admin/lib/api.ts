import type { AdminMetrics, LoginSuccess } from "@/lib/types";

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.trim();

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown> | string;
  token?: string;
  signal?: AbortSignal;
};

function buildUrl(path: string): string {
  const hasBase = Boolean(API_BASE);
  if (!hasBase) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }
  const base = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(normalizedPath, base);
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path);
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body === undefined
        ? undefined
        : typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body),
    signal: options.signal,
    cache: "no-store",
    credentials: "include",
    mode: "cors",
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // swallow parse errors
    }
    const baseMessage =
      (payload &&
        typeof payload === "object" &&
        "detail" in payload &&
        typeof (payload as any).detail === "string" &&
        (payload as any).detail) ||
      response.statusText ||
      "Unexpected error";
    const message = `${baseMessage} ((${response.status}) ${url})`;
    throw new ApiError(message, response.status, payload);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export function login(username: string, password: string) {
  return request<LoginSuccess>("/auth/login/", {
    method: "POST",
    body: { username, password },
  });
}

export function fetchMetrics(token: string) {
  return request<AdminMetrics>("/auth/metrics/summary/", {
    token,
  });
}
