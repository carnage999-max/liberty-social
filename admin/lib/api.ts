import type {
  AdminMetrics,
  LoginSuccess,
  ModerationActionEntry,
  ComplianceLogEntry,
  ContentClassificationEntry,
  AppealEntry,
} from "@/lib/types";

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

// KYC admin endpoints
export function fetchKycSubmissions(token: string) {
  return request<any[]>('/animals/verification/', { token });
}

export function approveKyc(token: string, id: number) {
  return request(`/animals/verification/${id}/approve/`, {
    method: 'POST',
    token,
  });
}

export function rejectKyc(token: string, id: number, reason?: string) {
  return request(`/animals/verification/${id}/reject/`, {
    method: 'POST',
    token,
    body: { reason: reason || '' },
  });
}

export function fetchAdminLogs(token: string, page: number = 1, page_size: number = 50) {
  const path = `/admin/action-logs/?page=${page}&page_size=${page_size}`;
  return request<any>(path, { token });
}

// Admin Security endpoints (Phase 3)
export function fetchUserSecurity(token: string, userId: string) {
  return request<any>(`/auth/admin/users/${userId}/security/`, { token });
}

export function fetchUserDevices(token: string, userId: string) {
  return request<any>(`/auth/admin/users/${userId}/devices/`, { token });
}

export function fetchUserActivity(token: string, userId: string, limit: number = 50, offset: number = 0) {
  return request<any>(`/auth/admin/users/${userId}/activity/?limit=${limit}&offset=${offset}`, { token });
}

export function lockUserAccount(token: string, userId: string, reason: string) {
  return request<any>(`/auth/admin/users/${userId}/lock/`, {
    method: "POST",
    token,
    body: { reason },
  });
}

export function unlockUserAccount(token: string, userId: string) {
  return request<any>(`/auth/admin/users/${userId}/unlock/`, {
    method: "POST",
    token,
  });
}

// User search for admin (using universal search endpoint)
export function searchUsers(token: string, query: string) {
  return request<any>(`/search/?q=${encodeURIComponent(query)}&type=user&limit=20`, { token });
}

type ModerationQuery = {
  start?: string;
  end?: string;
  content_type?: string;
  object_id?: string;
  label?: string;
  layer?: string;
  action?: string;
  category?: string;
  status?: string;
};

function toQueryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return search.toString();
}

export function fetchModerationActions(token: string, params: ModerationQuery = {}) {
  const qs = toQueryString(params);
  const path = qs ? `/moderation/actions/?${qs}` : "/moderation/actions/";
  return request<any>(path, { token });
}

export function fetchClassifications(token: string, params: ModerationQuery = {}) {
  const qs = toQueryString(params);
  const path = qs ? `/admin/moderation/classifications/?${qs}` : "/admin/moderation/classifications/";
  return request<any>(path, { token });
}

export function fetchComplianceLogs(token: string, params: ModerationQuery = {}) {
  const qs = toQueryString(params);
  const path = qs ? `/admin/moderation/compliance-logs/?${qs}` : "/admin/moderation/compliance-logs/";
  return request<any>(path, { token });
}

export function fetchAppealsAdmin(token: string, params: ModerationQuery = {}) {
  const qs = toQueryString(params);
  const path = qs ? `/admin/moderation/appeals/?${qs}` : "/admin/moderation/appeals/";
  return request<any>(path, { token });
}

export function decideAppealAdmin(token: string, id: number, decision: "approved" | "rejected") {
  return request<AppealEntry>(`/admin/moderation/appeals/${id}/decide/`, {
    method: "POST",
    token,
    body: { decision },
  });
}

export function bulkDecideAppealsAdmin(token: string, ids: number[], decision: "approved" | "rejected") {
  return request<{ updated: number; decision: string }>(`/admin/moderation/appeals/bulk-decide/`, {
    method: "POST",
    token,
    body: { ids, decision },
  });
}

async function exportCsv(token: string, path: string, filename: string) {
  const url = buildUrl(path);
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ApiError("Export failed", response.status, await response.text());
  }
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function exportModerationActions(token: string, params: ModerationQuery, filename: string) {
  const qs = toQueryString(params);
  const path = qs ? `/moderation/actions/export/?${qs}` : "/moderation/actions/export/";
  return exportCsv(token, path, filename);
}

export function exportClassifications(token: string, params: ModerationQuery, filename: string) {
  const qs = toQueryString(params);
  const path = qs ? `/admin/moderation/classifications/export/?${qs}` : "/admin/moderation/classifications/export/";
  return exportCsv(token, path, filename);
}

export function exportComplianceLogs(token: string, params: ModerationQuery, filename: string) {
  const qs = toQueryString(params);
  const path = qs ? `/admin/moderation/compliance-logs/export/?${qs}` : "/admin/moderation/compliance-logs/export/";
  return exportCsv(token, path, filename);
}
