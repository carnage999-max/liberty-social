"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";
import type { PageAdminInvite, Page as BusinessPage } from "@/lib/types";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";

export default function AdminInvitesPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [invites, setInvites] = useState<PageAdminInvite[]>([]);
  const [managedPages, setManagedPages] = useState<BusinessPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "moderator">("admin");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiGet<PageAdminInvite[] | { results?: PageAdminInvite[] }>("/admin-invites/", {
          token: accessToken,
        });
        if (!cancelled) {
          // Handle both array and paginated response formats
          const inviteList = Array.isArray(data) ? data : (data?.results || []);
          setInvites(inviteList || []);
        }

        const pagesData = await apiGet<BusinessPage[]>("/pages/mine/", {
          token: accessToken,
        });
        if (!cancelled) {
          setManagedPages(pagesData || []);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.show("Failed to load data", "error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, toast]);

  async function actOnInvite(id: number, action: "accept" | "decline") {
    if (!accessToken) return;
    try {
      await apiPost(`/admin-invites/${id}/${action}/`, undefined, { token: accessToken });
      setInvites((prev) => prev.filter((invite) => invite.id !== id));
      toast.show(`Invite ${action}ed`, "success");
    } catch (error) {
      console.error(error);
      toast.show("Failed to update invite", "error");
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !selectedPage || !inviteEmail.trim()) return;

    setSubmitting(true);
    try {
      await apiPost(
        `/pages/${selectedPage}/invite-admin/`,
        { email: inviteEmail.trim(), role: inviteRole },
        { token: accessToken }
      );
      toast.show("Invite sent successfully!", "success");
      setInviteEmail("");
      setSelectedPage(null);
    } catch (error) {
      console.error(error);
      toast.show("Failed to send invite", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/app/pages"
          className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-sm --color-silver-md hover:bg-deep-navy/5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
        <header className="flex-1">
          <h1 className="text-2xl font-semibold --color-silver-mid">Page admin management</h1>
          <p className="text-sm text-gray-400">Send and manage invitations to administer your business pages.</p>
        </header>
      </div>

      {/* Send Invites Section */}
      {managedPages.length > 0 && (
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-black">Send admin invitation</h2>
          <form onSubmit={handleSendInvite} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-black">Select page</label>
                <select
                  required
                  value={selectedPage || ""}
                  onChange={(e) => setSelectedPage(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                >
                  <option value="">Choose a page...</option>
                  {managedPages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-black">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "editor" | "moderator")}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="moderator">Moderator</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-black">Email address</label>
              <input
                required
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !selectedPage || !inviteEmail.trim()}
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:opacity-70"
            >
              {submitting ? "Sending..." : "Send Invitation"}
            </button>
          </form>
        </section>
      )}

      {/* Received Invites Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold --color-silver-mid">Invitations received</h2>

        {invites.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-700">
              You don&apos;t have any pending invitations to manage pages.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 className="text-base font-semibold text-black">{invite.page?.name}</h3>
                  <p className="text-sm text-gray-700">
                    Invited by {invite.inviter.first_name} {invite.inviter.last_name || ""} · Role: <span className="font-semibold">{invite.role}</span>
                  </p>
                  <p className="text-xs text-gray-600">Status: {invite.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {invite.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => actOnInvite(invite.id, "accept")}
                        className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-900"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => actOnInvite(invite.id, "decline")}
                        className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
