"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiGet, type PaginatedResponse } from "@/lib/api";

type ModerationActionEntry = {
  id: number;
  content_type: { app_label: string; model: string } | null;
  object_id: string | null;
  layer: string;
  action: string;
  reason_code: string;
  rule_ref: string;
  metadata: Record<string, unknown>;
  actor: string | number | null;
  created_at: string;
};

export default function ModerationHistoryPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<ModerationActionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<PaginatedResponse<ModerationActionEntry>>(
          `/moderation/actions/?page=${page}&page_size=20`,
          { token: accessToken, cache: "no-store" }
        );
        setItems(data.results || []);
        setCount(data.count || 0);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Unable to load moderation history.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [accessToken, page]);

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div className="space-y-8 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex flex-col gap-2">
          <Link
            href="/app/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-(--color-deep-navy) shadow-sm transition hover:bg-gray-50"
          >
            <span aria-hidden="true">←</span>
            Back to settings
          </Link>
          <h1 className="text-2xl font-bold --color-silver-mid">Moderation history</h1>
          <p className="text-sm text-gray-400">
            Review recent moderation actions tied to your content.
          </p>
        </header>

        <section className="rounded-[18px] border border-gray-100 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500">No moderation actions found.</div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-900">
                    {item.layer} · {item.action} · {item.reason_code}
                  </div>
                  <div className="text-xs text-gray-600">
                    {item.content_type?.model || "content"} #{item.object_id || "n/a"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {count > 20 && (
            <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
