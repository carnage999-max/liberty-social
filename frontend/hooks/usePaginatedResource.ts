"use client";

import { useAuth } from "@/lib/auth-context";
import {
  apiGet,
  apiGetUrl,
  type PaginatedResponse,
} from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Options = {
  enabled?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
};

type PaginatedState<T> = {
  items: T[];
  count: number;
  next: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function usePaginatedResource<T>(
  path: string,
  options: Options = {}
): PaginatedState<T> {
  const { accessToken } = useAuth();
  const { enabled = true, query } = options;
  const [items, setItems] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastInitialPath = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const initialPath = useMemo(() => {
    if (!query) return path;
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      params.append(key, String(value));
    });
    const qs = params.toString();
    if (!qs) return path;
    return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
  }, [path, query]);

  const fetchPage = useCallback(
    async (url?: string, append = false) => {
      if (!accessToken) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);

        const raw = await (url
          ? apiGetUrl<PaginatedResponse<T> | T[]>(url, {
              token: accessToken,
              cache: "no-store",
              signal: controller.signal,
            })
          : apiGet<PaginatedResponse<T> | T[]>(initialPath, {
              token: accessToken,
              cache: "no-store",
              signal: controller.signal,
            }));

        const isPaginated =
          raw &&
          typeof raw === "object" &&
          !Array.isArray(raw) &&
          Object.prototype.hasOwnProperty.call(raw, "results");

        const results = isPaginated
          ? ((raw as PaginatedResponse<T>).results ?? [])
          : Array.isArray(raw)
          ? raw
          : [];
        const totalCount =
          isPaginated && typeof (raw as PaginatedResponse<T>).count === "number"
            ? (raw as PaginatedResponse<T>).count
            : null;
        const nextUrl = isPaginated
          ? (raw as PaginatedResponse<T>).next ?? null
          : null;

        let computedItems: T[] = [];
        setItems((prev) => {
          computedItems = append ? [...prev, ...results] : results;
          return computedItems;
        });
        setCount(
          typeof totalCount === "number" ? totalCount : computedItems.length
        );
        setNext(nextUrl);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error(err);
        setError(err?.message || "Unable to load data.");
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, initialPath]
  );

  useEffect(() => {
    if (!enabled || !accessToken) return;
    if (lastInitialPath.current === initialPath && items.length > 0) return;
    lastInitialPath.current = initialPath;
    fetchPage();
    return () => {
      controllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, accessToken, initialPath]);

  const loadMore = useCallback(async () => {
    if (!next) return;
    await fetchPage(next, true);
  }, [next, fetchPage]);

  const refresh = useCallback(async () => {
    await fetchPage();
  }, [fetchPage]);

  return {
    items,
    count,
    next,
    loading,
    loadingMore,
    error,
    loadMore,
    refresh,
  };
}
