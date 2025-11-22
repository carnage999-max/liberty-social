"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiGet, type PaginatedResponse } from "@/lib/api";
import type { Page as BusinessPage } from "@/lib/types";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import ShareModal from "@/components/modals/ShareModal";

type TabType = "create" | "discover" | "invitations" | "liked";

export default function PagesIndexPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<BusinessPage[]>([]);
  const [managedPages, setManagedPages] = useState<BusinessPage[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("discover");
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

  const tabs: { id: TabType; label: string }[] = [
    { id: "create", label: "Create Page" },
    { id: "discover", label: "Discover" },
    { id: "invitations", label: "Invitations" },
    { id: "liked", label: "Liked/Following" },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-6 sm:gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap pb-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-b-2 border-(--color-gold) text-(--color-gold)"
                  : "text-(--color-muted) hover:text-(--color-silver-mid)"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pages You Manage */}
      {!loading && managedPages.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-(--color-silver-mid)">Pages You Manage</h2>
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

      {/* Tab Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          {activeTab === "create" && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-(--color-silver-mid)">Create a New Page</h2>
              <div className="rounded-2xl border border-(--color-border) bg-white/70 p-8 text-center">
                <p className="mb-4 text-(--color-muted)">Start a new business page to engage with your community.</p>
                <Link
                  href="/app/pages/create"
                  className="inline-flex items-center gap-2 rounded-full btn-primary px-6 py-2 text-sm font-semibold text-white shadow-metallic transition hover:opacity-90"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Create Page
                </Link>
              </div>
            </section>
          )}

          {activeTab === "discover" && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-(--color-silver-mid)">Discover Pages</h2>
              {pages.length === 0 ? (
                <div className="rounded-2xl border border-(--color-border) bg-white/70 p-8 text-center">
                  <p className="text-(--color-muted)">No pages found yet. Be the first to create one!</p>
                </div>
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
          )}

          {activeTab === "invitations" && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-(--color-silver-mid)">Page Invitations</h2>
              <div className="rounded-2xl border border-(--color-border) bg-white/70 p-8 text-center">
                <p className="mb-4 text-(--color-muted)">Pending invitations to manage pages will appear here.</p>
                <Link
                  href="/app/admin-invites"
                  className="inline-flex items-center gap-2 rounded-full bg-(--color-deep-navy) px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  View All Invites
                </Link>
              </div>
            </section>
          )}

          {activeTab === "liked" && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-(--color-silver-mid)">Pages You're Following</h2>
              {managedPages.length === 0 ? (
                <div className="rounded-2xl border border-(--color-border) bg-white/70 p-8 text-center">
                  <p className="text-(--color-muted)">Pages you follow will appear here.</p>
                </div>
              ) : (
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
              )}
            </section>
          )}
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
        className="flex-shrink-0 rounded-full bg-(--color-gold) border-2 border-(--color-gold) p-2 text-(--color-deeper-navy) transition hover:opacity-80"
        aria-label="Share page"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M12 2v10M7 7l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
