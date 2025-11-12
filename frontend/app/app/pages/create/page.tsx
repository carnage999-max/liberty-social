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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        website_url: form.website_url.trim() || null,
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
    <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-(--color-border) bg-white/80 p-6 shadow">
      <header>
        <h1 className="text-2xl font-semibold text-(--color-deep-navy)">Create a business page</h1>
        <p className="text-sm text-(--color-muted)">Share your brand or community with Liberty Social.</p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-(--color-deep-navy)">Page name</label>
          <input
            required
            className="w-full rounded-2xl border border-(--color-border) px-4 py-3 text-sm focus:border-(--color-deep-navy) focus:outline-none"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. Liberty Café"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-(--color-deep-navy)">Description</label>
          <textarea
            className="w-full rounded-2xl border border-(--color-border) px-4 py-3 text-sm focus:border-(--color-deep-navy) focus:outline-none"
            rows={4}
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Tell people what your page is about..."
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-(--color-deep-navy)">Category</label>
          <select
            className="w-full rounded-2xl border border-(--color-border) px-4 py-3 text-sm focus:border-(--color-deep-navy) focus:outline-none"
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
            <label className="text-sm font-semibold text-(--color-deep-navy)">Website</label>
            <input
              type="url"
              className="w-full rounded-2xl border border-(--color-border) px-4 py-3 text-sm focus:border-(--color-deep-navy) focus:outline-none"
              value={form.website_url}
              onChange={(event) => setForm((prev) => ({ ...prev, website_url: event.target.value }))}
              placeholder="https://"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-(--color-deep-navy)">Email</label>
            <input
              type="email"
              className="w-full rounded-2xl border border-(--color-border) px-4 py-3 text-sm focus:border-(--color-deep-navy) focus:outline-none"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-(--color-deep-navy)">Phone</label>
          <input
            className="w-full rounded-2xl border border-(--color-border) px-4 py-3 text-sm focus:border-(--color-deep-navy) focus:outline-none"
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
