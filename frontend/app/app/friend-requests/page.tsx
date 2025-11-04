"use client";

import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { apiPost } from "@/lib/api";
import type { FriendRequest } from "@/lib/types";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import Image from "next/image";
import { useMemo, useState } from "react";

type Tab = "incoming" | "outgoing" | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Sent" },
  { id: "all", label: "All" },
];

export default function FriendRequestsPage() {
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("incoming");

  const query = useMemo(() => {
    if (activeTab === "all") return {};
    return { direction: activeTab };
  }, [activeTab]);

  const {
    items,
    loading,
    error,
    next,
    loadMore,
    loadingMore,
    refresh,
    count,
  } = usePaginatedResource<FriendRequest>("/auth/friend-requests/", {
    query,
  });

  const [pendingAction, setPendingAction] = useState<number | null>(null);

  const handleAction = async (
    requestId: number,
    action: "accept" | "decline" | "cancel"
  ) => {
    if (!accessToken) return;
    try {
      setPendingAction(requestId);
      const suffix =
        action === "accept"
          ? "accept-friend-request"
          : action === "decline"
          ? "decline"
          : "cancel";
      await apiPost(`/auth/friend-requests/${requestId}/${suffix}/`, undefined, {
        token: accessToken,
        cache: "no-store",
      });
      await refresh();
      const message =
        action === "accept"
          ? "Friend request accepted."
          : action === "decline"
          ? "Friend request declined."
          : "Friend request cancelled.";
      toast.show(message);
    } catch (err) {
      console.error(err);
      toast.show("Something went wrong. Please try again.", "error");
    } finally {
      setPendingAction(null);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl bg-white/90 p-8 text-center shadow-sm">
          <p className="text-sm text-gray-700">{error}</p>
          <button
            onClick={() => refresh()}
            className="mt-4 rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
          >
            Retry
          </button>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">You&apos;re all caught up!</h2>
          <p className="mt-2 text-sm text-gray-500">No friend requests in this view.</p>
        </div>
      );
    }

    return (
      <>
        <ul className="space-y-4">
          {items.map((request) => {
            const isIncoming =
              request.to_user && request.to_user.id && request.to_user.id === user?.id;
            const peer = isIncoming ? request.from_user : request.to_user;
            const displayName =
              peer?.username ||
              [peer?.first_name, peer?.last_name].filter(Boolean).join(" ") ||
              peer?.email ||
              "User";
            const avatarInitial =
              (peer?.username || peer?.email || displayName || "U")[0]?.toUpperCase() || "U";

            return (
              <li
                key={request.id}
                className="flex items-center justify-between gap-4 rounded-[16px] border border-gray-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                    {peer?.profile_image_url ? (
                      <Image
                        src={peer.profile_image_url}
                        alt={displayName}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-base font-semibold text-gray-600">{avatarInitial}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                    <p className="text-xs text-gray-500">
                      {isIncoming ? "Requested to connect with you" : "Sent by you"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isIncoming ? (
                    <>
                      <button
                        onClick={() => handleAction(request.id, "accept")}
                        disabled={pendingAction === request.id}
                        className="rounded-lg btn-primary px-3 py-1.5 text-xs font-semibold text-white shadow hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleAction(request.id, "decline")}
                        disabled={pendingAction === request.id}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAction(request.id, "cancel")}
                      disabled={pendingAction === request.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {next && (
          <div className="flex justify-center pt-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-lg border border-(--color-deep-navy) px-5 py-2 text-sm font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-300">Friend requests</h1>
          <p className="text-sm text-gray-500">
            {count === 0 ? "No pending requests" : `${count} request${count === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex gap-2 rounded-[12px] bg-white/90 p-1 shadow-sm backdrop-blur-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "btn-primary text-white shadow"
                    : "text-(--color-deep-navy) hover:bg-(--metallic-silver)/60"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {renderContent()}
    </div>
  );
}

