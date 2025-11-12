"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";
import type { PageAdminInvite } from "@/lib/types";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";

export default function AdminInvitesPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [invites, setInvites] = useState<PageAdminInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiGet<PageAdminInvite[]>("/admin-invites/", {
          token: accessToken,
        });
        if (!cancelled) {
          setInvites(data || []);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.show("Failed to load invites", "error");
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-(--color-deep-navy)">Page admin invites</h1>
        <p className="text-sm text-(--color-muted)">Accept or decline invitations to manage business pages.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : invites.length === 0 ? (
        <p className="rounded-3xl border border-(--color-border) bg-white/80 p-6 text-sm text-(--color-muted)">
          You don&apos;t have any pending invites.
        </p>
      ) : (
        <ul className="space-y-4">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-col gap-4 rounded-3xl border border-(--color-border) bg-white/80 p-5 shadow md:flex-row md:items-center md:justify-between"
            >
              <div>
                <h3 className="text-base font-semibold text-(--color-deep-navy)">{invite.page?.name}</h3>
                <p className="text-sm text-(--color-muted)">
                  Invited by {invite.inviter.first_name} {invite.inviter.last_name || ""} · Role: {invite.role}
                </p>
                <p className="text-xs text-(--color-muted)">Status: {invite.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {invite.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => actOnInvite(invite.id, "accept")}
                      className="rounded-full bg-(--color-deep-navy) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--color-deeper-navy)"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => actOnInvite(invite.id, "decline")}
                      className="rounded-full border border-(--color-border) px-4 py-2 text-sm font-semibold text-(--color-deep-navy) transition hover:border-(--color-deep-navy)"
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
    </div>
  );
}
