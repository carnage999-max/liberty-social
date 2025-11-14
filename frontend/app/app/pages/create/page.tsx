"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiPost } from "@/lib/api";
import type { Page } from "@/lib/types";
import { useToast } from "@/components/Toast";

const CATEGORIES = [
  { value: "business", label: "Business" },
  { value: "community", label: "Community" },
  { value: "brand", label: "Brand" },
  { value: "other", label: "Other" },
];

export default function CreatePagePage() {
  const router = useRouter();
  const toast = useToast();
  const { accessToken } = useAuth();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "business",
    website_url: "",
    phone: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function normalizeWebsiteUrl(url: string): string {
    if (!url.trim()) return "";
    url = url.trim();
    // Add https:// if no protocol is present
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    return url;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        website_url: form.website_url.trim() ? normalizeWebsiteUrl(form.website_url) : null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      };
      const page = await apiPost<Page>("/pages/", payload, {
        token: accessToken,
      });
      toast.show("Page created successfully!", "success");
      router.push(`/app/pages/${page.id}`);
    } catch (error) {
      console.error(error);
      toast.show("Failed to create page", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-(--color-border) bg-white p-6 shadow text-black">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <header className="flex-1">
          <h1 className="text-2xl font-semibold text-black">Create a business page</h1>
          <p className="text-sm text-gray-600">Share your brand or community with Liberty Social.</p>
        </header>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-black">Page name</label>
          <input
            required
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. Liberty Café"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-black">Description</label>
          <textarea
            className="w-full resize-none rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
            rows={4}
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Tell people what your page is about..."
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-black">Category</label>
          <select
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
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
              type="text"
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
              value={form.website_url}
              onChange={(event) => setForm((prev) => ({ ...prev, website_url: event.target.value }))}
              placeholder="example.com or www.example.com"
            />
            <p className="text-xs text-gray-500">https:// will be added automatically if needed</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-black">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-black">Phone</label>
          <input
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-(--color-deep-navy) px-4 py-3 text-sm font-semibold text-white transition hover:bg-(--color-deeper-navy) disabled:opacity-70"
        >
          {submitting ? "Creating..." : "Create Page"}
        </button>
      </form>
    </div>
  );
}
