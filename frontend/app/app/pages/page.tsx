"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiGet, type PaginatedResponse } from "@/lib/api";
import type { Page as BusinessPage } from "@/lib/types";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";

export default function PagesIndexPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<BusinessPage[]>([]);
  const [managedPages, setManagedPages] = useState<BusinessPage[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function loadPages() {
      setLoading(true);
      try {
        const data = await apiGet<PaginatedResponse<BusinessPage>>("/pages/", {
          token: accessToken,
        });
        if (!cancelled) {
          setPages(data.results || []);
        }
        const mine = await apiGet<BusinessPage[]>("/pages/mine/", {
          token: accessToken,
        });
        if (!cancelled) {
          setManagedPages(mine || []);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.show("Failed to load pages", "error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadPages();
    return () => {
      cancelled = true;
    };
  }, [accessToken, toast]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-(--color-deep-navy)">Business Pages</h1>
          <p className="text-sm text-(--color-muted)">Discover and manage business profiles.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/app/admin-invites"
            className="rounded-full border border-(--color-border) px-4 py-2 text-sm font-semibold text-(--color-deep-navy) transition hover:border-(--color-deep-navy)"
          >
            View invites
          </Link>
          <Link
            href="/app/pages/create"
            className="rounded-full bg-(--color-deep-navy) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--color-deeper-navy)"
          >
            Create page
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          {managedPages.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-(--color-deep-navy)">Pages you manage</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {managedPages.map((page) => (
                  <PageCard key={page.id} page={page} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-(--color-deep-navy)">All pages</h2>
            {pages.length === 0 ? (
              <p className="text-sm text-(--color-muted)">No pages found yet. Be the first to create one!</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pages.map((page) => (
                  <PageCard key={page.id} page={page} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PageCard({ page }: { page: BusinessPage }) {
  return (
    <Link
      href={`/app/pages/${page.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-(--color-border) bg-white/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
    >
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-(--color-soft-bg)">
        {page.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.profile_image_url}
            alt={page.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-(--color-deep-navy)">
            {page.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-(--color-deep-navy) group-hover:text-(--color-primary)">
            {page.name}
          </h3>
          {page.is_verified && (
            <span className="rounded-full bg-(--color-primary-light) px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--color-primary)">
              Verified
            </span>
          )}
        </div>
        <p className="text-sm text-(--color-muted)">{page.category}</p>
      </div>
    </Link>
  );
}
