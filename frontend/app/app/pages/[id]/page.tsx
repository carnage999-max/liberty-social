"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";
import type { Page as BusinessPage, PageAdmin } from "@/lib/types";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";

export default function PageDetail() {
  const params = useParams<{ id: string }>();
  const pageId = params?.id;
  const { accessToken } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState<BusinessPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [admins, setAdmins] = useState<PageAdmin[]>([]);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    if (!accessToken || !pageId) return;
    let cancelled = false;
    async function loadPage() {
      setLoading(true);
      try {
        const detail = await apiGet<BusinessPage>(`/pages/${pageId}/`, {
          token: accessToken,
        });
        if (cancelled) return;
        setPage(detail);
        setIsFollowing(Boolean(detail.is_following));
        await loadAdmins(detail.id, cancelled);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.show("Page not found", "error");
          notFound();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    async function loadAdmins(id: number, cancelledFlag: boolean) {
      try {
        const data = await apiGet<PageAdmin[]>(`/pages/${id}/admins/`, {
          token: accessToken,
        });
        if (!cancelledFlag) {
          setAdmins(data || []);
          setCanManage(true);
        }
      } catch {
        setCanManage(false);
      }
    }

    loadPage();
    return () => {
      cancelled = true;
    };
  }, [accessToken, pageId, toast]);

  const toggleFollow = useCallback(async () => {
    if (!accessToken || !page) return;
    try {
      const res = await apiPost<{ following: boolean; follower_count: number }>(
        `/pages/${page.id}/follow/`,
        undefined,
        { token: accessToken }
      );
      setIsFollowing(res.following);
      setPage((prev) =>
        prev
          ? {
              ...prev,
              follower_count: res.follower_count,
            }
          : prev
      );
    } catch (error) {
      console.error(error);
      toast.show("Failed to update follow status", "error");
    }
  }, [accessToken, page, toast]);

  if (!pageId) {
    notFound();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!page) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-(--color-border) bg-white/80 shadow">
        <div className="relative h-48 w-full overflow-hidden rounded-t-3xl bg-(--color-soft-bg)">
          {page.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.cover_image_url}
              alt={`${page.name} cover`}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="-mt-14 flex flex-col gap-4 px-6 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="flex gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-(--color-soft-bg)">
              {page.profile_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.profile_image_url}
                  alt={page.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-(--color-deep-navy)">
                  {page.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-(--color-deep-navy)">{page.name}</h1>
                {page.is_verified && (
                  <span className="rounded-full bg-(--color-primary-light) px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--color-primary)">
                    Verified
                  </span>
                )}
              </div>
              <p className="text-sm text-(--color-muted) capitalize">{page.category}</p>
              <p className="text-sm text-(--color-muted)">
                {page.follower_count || 0} follower{(page.follower_count || 0) === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={toggleFollow}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isFollowing
                  ? "border border-(--color-border) text-(--color-deep-navy) hover:border-(--color-deep-navy)"
                  : "bg-(--color-deep-navy) text-white hover:bg-(--color-deeper-navy)"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 rounded-3xl border border-(--color-border) bg-white/70 p-5 shadow md:col-span-2">
          <h2 className="text-lg font-semibold text-(--color-deep-navy)">About</h2>
          <p className="text-sm text-(--color-muted) whitespace-pre-line">
            {page.description || "No description provided yet."}
          </p>
          <div className="grid gap-3 text-sm text-(--color-deep-navy)">
            {page.website_url && (
              <div>
                Website:{" "}
                <a href={page.website_url} target="_blank" rel="noreferrer" className="text-(--color-primary)">
                  {page.website_url}
                </a>
              </div>
            )}
            {page.email && <div>Email: {page.email}</div>}
            {page.phone && <div>Phone: {page.phone}</div>}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-(--color-border) bg-white/70 p-5 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-(--color-deep-navy)">Admins</h2>
            {canManage && (
              <Link
                href="/app/admin-invites"
                className="text-sm font-semibold text-(--color-primary) hover:underline"
              >
                Manage
              </Link>
            )}
          </div>
          {admins.length === 0 ? (
            <p className="text-sm text-(--color-muted)">Admin details unavailable.</p>
          ) : (
            <ul className="space-y-2">
              {admins.map((admin) => (
                <li key={admin.id} className="flex items-center justify-between rounded-2xl bg-(--color-soft-bg) px-3 py-2 text-sm">
                  <span className="font-semibold text-(--color-deep-navy)">
                    {admin.user.first_name} {admin.user.last_name || ""}
                  </span>
                  <span className="text-xs uppercase text-(--color-muted)">{admin.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
