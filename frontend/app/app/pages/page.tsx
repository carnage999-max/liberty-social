"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiGet, type PaginatedResponse } from "@/lib/api";
import type { Page as BusinessPage } from "@/lib/types";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import ShareModal from "@/components/modals/ShareModal";

export default function PagesIndexPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<BusinessPage[]>([]);
  const [managedPages, setManagedPages] = useState<BusinessPage[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalPage, setShareModalPage] = useState<BusinessPage | null>(null);

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
          <h1 className="text-2xl font-semibold text-(--color-silver-mid)">Business Pages</h1>
          <p className="text-sm text-(--color-muted)">Discover and manage business profiles.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/app/admin-invites"
            className="rounded-full border border-(--color-border) px-4 py-2 text-sm font-semibold text-(--color-silver-mid) transition hover:border-(--color-gold)"
          >
            View invites
          </Link>
          <Link
            href="/app/pages/create"
            className="rounded-full bg-(--color-deep-navy) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--color-gold)"
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
              <h2 className="mb-3 text-lg font-semibold text-(--color-silver-mid)">Pages you manage</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {managedPages.map((page) => (
                  <PageCard 
                    key={page.id} 
                    page={page}
                    onShare={() => {
                      setShareModalPage(page);
                      setShareModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-(--color-silver-mid)">All pages</h2>
            {pages.length === 0 ? (
              <p className="text-sm text-(--color-muted)">No pages found yet. Be the first to create one!</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pages.map((page) => (
                  <PageCard 
                    key={page.id} 
                    page={page}
                    onShare={() => {
                      setShareModalPage(page);
                      setShareModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setShareModalPage(null);
        }}
        shareUrl={shareModalPage ? `${typeof window !== 'undefined' ? window.location.origin : ''}/app/pages/${shareModalPage.id}` : ''}
        title="Share Page"
        type="page"
      />
    </div>
  );
}

function PageCard({ page, onShare }: { page: BusinessPage; onShare: () => void }) {
  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-(--color-border) bg-white/70 p-4 shadow-sm transition hover:shadow">
      <Link
        href={`/app/pages/${page.id}`}
        className="flex flex-1 items-center gap-4 transition hover:-translate-y-0.5"
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
            <h3 className="text-base font-semibold text-(--color-deep-navy)">
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
      <button
        onClick={onShare}
        className="flex-shrink-0 rounded-full border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-100 hover:border-gray-300"
        aria-label="Share page"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M12 2v10M7 7l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
