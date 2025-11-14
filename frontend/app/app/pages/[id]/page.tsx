"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import type { Page as BusinessPage, PageAdmin } from "@/lib/types";
import Spinner from "@/components/Spinner";
import Gallery from "@/components/Gallery";
import ImageUploadField from "@/components/ImageUploadField";
import { useToast } from "@/components/Toast";

const CATEGORIES = [
  { value: "business", label: "Business" },
  { value: "community", label: "Community" },
  { value: "brand", label: "Brand" },
  { value: "other", label: "Other" },
];

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
  const [isEditing, setIsEditing] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    category: "business",
    website_url: "",
    phone: "",
    email: "",
    profile_image_url: "",
    cover_image_url: "",
  });
  const [submitting, setSubmitting] = useState(false);

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
        setEditForm({
          name: detail.name || "",
          description: detail.description || "",
          category: detail.category || "business",
          website_url: detail.website_url || "",
          phone: detail.phone || "",
          email: detail.email || "",
          profile_image_url: detail.profile_image_url || "",
          cover_image_url: detail.cover_image_url || "",
        });
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

  const handleEditClick = () => {
    if (page) {
      setEditForm({
        name: page.name || "",
        description: page.description || "",
        category: page.category || "business",
        website_url: page.website_url || "",
        phone: page.phone || "",
        email: page.email || "",
        profile_image_url: page.profile_image_url || "",
        cover_image_url: page.cover_image_url || "",
      });
      setIsEditing(true);
    }
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken || !page) return;
    setSubmitting(true);
    try {
      const payload: any = {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        category: editForm.category,
        website_url: editForm.website_url.trim() || null,
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
      };

      // Include profile_image_url in payload if it changed
      if (editForm.profile_image_url !== page.profile_image_url) {
        payload.profile_image_url = editForm.profile_image_url || null;
      }

      // Include cover_image_url in payload if it changed
      if (editForm.cover_image_url !== page.cover_image_url) {
        payload.cover_image_url = editForm.cover_image_url || null;
      }

      const updated = await apiPatch<BusinessPage>(`/pages/${page.id}/`, payload, {
        token: accessToken,
      });

      console.log("Page updated with response:", updated);
      setPage(updated);
      setIsEditing(false);
      toast.show("Page updated successfully!", "success");
    } catch (error) {
      console.error(error);
      toast.show("Failed to update page", "error");
    } finally {
      setSubmitting(false);
    }
  };

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
      <Gallery
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        images={page.profile_image_url ? [page.profile_image_url] : []}
      />
      <section className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="relative h-48 w-full bg-gray-100">
          {page.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.cover_image_url}
              alt={`${page.name} cover`}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="flex flex-col gap-4 px-6 pt-6 pb-6 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-gray-100 shadow-md">
              {page.profile_image_url ? (
                <button
                  type="button"
                  onClick={() => setGalleryOpen(true)}
                  className="h-full w-full cursor-pointer transition hover:opacity-80"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.profile_image_url}
                    alt={page.name}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-gray-700">
                  {page.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-black">{page.name}</h1>
                {page.is_verified && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                    Verified
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 capitalize">{page.category}</p>
              <p className="text-sm text-gray-600">
                {page.follower_count || 0} follower{(page.follower_count || 0) === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex gap-3 md:flex-shrink-0">
            <button
              type="button"
              onClick={toggleFollow}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isFollowing
                  ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  : "bg-black text-white hover:bg-gray-900"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
            {canManage && (
              <button
                type="button"
                onClick={handleEditClick}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:col-span-2">
          <h2 className="text-lg font-semibold text-black">About</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {page.description || "No description provided yet."}
          </p>
          <div className="grid gap-3 text-sm text-gray-700">
            {page.website_url && (
              <div>
                Website:{" "}
                <a href={page.website_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  {page.website_url}
                </a>
              </div>
            )}
            {page.email && <div>Email: {page.email}</div>}
            {page.phone && <div>Phone: {page.phone}</div>}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">Admins</h2>
            {canManage && (
              <Link
                href="/app/admin-invites"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                Manage
              </Link>
            )}
          </div>
          {admins.length === 0 ? (
            <p className="text-sm text-gray-600">Admin details unavailable.</p>
          ) : (
            <ul className="space-y-2">
              {admins.map((admin) => (
                <li key={admin.id} className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-gray-900">
                    {admin.user.first_name} {admin.user.last_name || ""}
                  </span>
                  <span className="text-xs uppercase text-gray-600">{admin.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="mx-auto w-full max-w-2xl space-y-6 rounded-3xl border border-(--color-border) bg-white p-6 shadow text-black">
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>

              <header className="flex-1">
                <h1 className="text-2xl font-semibold text-black">Edit business page</h1>
                <p className="text-sm text-gray-600">Update your page details.</p>
              </header>
            </div>

            <form className="space-y-4" onSubmit={handleEditSubmit}>
              <ImageUploadField
                label="Profile Image"
                value={editForm.profile_image_url}
                onChange={(url) => {
                  console.log("ImageUploadField onChange called with URL:", url);
                  setEditForm((prev) => {
                    const updated = { ...prev, profile_image_url: url };
                    console.log("Updated editForm:", updated);
                    return updated;
                  });
                }}
                disabled={submitting}
              />

              <ImageUploadField
                label="Cover Image"
                value={editForm.cover_image_url}
                onChange={(url) => {
                  console.log("Cover ImageUploadField onChange called with URL:", url);
                  setEditForm((prev) => {
                    const updated = { ...prev, cover_image_url: url };
                    console.log("Updated editForm with cover image:", updated);
                    return updated;
                  });
                }}
                disabled={submitting}
              />

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-black">Page name</label>
                <input
                  required
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. Liberty Café"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-black">Description</label>
                <textarea
                  className="w-full resize-none rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
                  rows={4}
                  value={editForm.description}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Tell people what your page is about..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-black">Category</label>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
                  value={editForm.category}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-black">Website</label>
                  <input
                    type="url"
                    className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
                    value={editForm.website_url}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, website_url: event.target.value }))}
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-black">Email</label>
                  <input
                    type="email"
                    className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
                    value={editForm.email}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-black">Phone</label>
                <input
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
                  value={editForm.phone}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={submitting}
                  className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-(--color-deep-navy) px-5 py-2 text-sm font-semibold text-white transition hover:bg-(--color-deeper-navy) disabled:opacity-70"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
