"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { MarketplaceOffer } from "@/lib/types";
import { apiGet, apiPatch } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
};

interface OfferWithDetails extends MarketplaceOffer {
  listing: any;
  buyer: any;
  seller: any;
}

export default function OffersPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [offers, setOffers] = useState<OfferWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);

  // Load offers
  useEffect(() => {
    const loadOffers = async () => {
      if (!user) return;

      try {
        const response = await apiGet("/marketplace/offers/");
        const allOffers: OfferWithDetails[] = response.results || response;

        setOffers(allOffers);
      } catch (error) {
        console.error("Failed to load offers:", error);
        toast.show("Failed to load offers", "error");
      } finally {
        setLoading(false);
      }
    };

    loadOffers();
  }, [user, toast]);

  // Filter offers based on tab
  const filteredOffers =
    tab === "received"
      ? offers.filter((o) => o.listing?.seller?.id === user?.id)
      : offers.filter((o) => o.buyer?.id === user?.id);

  const handleAcceptOffer = async (offer: OfferWithDetails) => {
    setUpdatingId(offer.id);

    try {
      const updated = await apiPatch(`/marketplace/offers/${offer.id}/`, {
        status: "accepted",
      });

      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, ...updated } : o))
      );

      toast.show("Offer accepted!", "success");
    } catch (error) {
      console.error("Failed to accept offer:", error);
      toast.show("Failed to accept offer", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeclineOffer = async (offer: OfferWithDetails) => {
    setUpdatingId(offer.id);

    try {
      const updated = await apiPatch(`/marketplace/offers/${offer.id}/`, {
        status: "declined",
      });

      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, ...updated } : o))
      );

      toast.show("Offer declined", "success");
    } catch (error) {
      console.error("Failed to decline offer:", error);
      toast.show("Failed to decline offer", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Check authentication
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to view your offers</p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black">Marketplace Offers</h1>
          <p className="text-gray-600 mt-1">
            Manage offers you've made and received
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your offers...</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        {!loading && offers.length > 0 && (
          <div className="mb-6 border-b border-gray-200">
            <div className="flex gap-6">
              {[
                { id: "received", label: "Offers Received" },
                { id: "sent", label: "Offers Sent" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setTab(id as any)}
                  className={`px-4 py-3 font-semibold text-sm border-b-2 transition ${
                    tab === id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {label}
                  <span className="ml-2 inline-block rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                    {(tab === "received"
                      ? offers.filter((o) => o.listing?.seller?.id === user?.id)
                      : offers.filter((o) => o.buyer?.id === user?.id)
                    ).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && offers.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No offers yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start browsing listings to make offers
            </p>
            <Link
              href="/app/marketplace"
              className="inline-block px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Browse Listings
            </Link>
          </div>
        )}

        {/* Offers List */}
        {!loading && filteredOffers.length > 0 && (
          <div className="space-y-3">
            {filteredOffers.map((offer) => {
              const isReceived = tab === "received";
              const otherUser = isReceived ? offer.buyer : offer.listing?.seller;
              const mainImage = offer.listing?.media?.[0]?.url;

              return (
                <div
                  key={offer.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-gray-300 transition"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* Image */}
                    <Link
                      href={`/app/marketplace/${offer.listing?.id}`}
                      className="sm:col-span-1 relative h-32 sm:h-40 rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition flex-shrink-0"
                    >
                      {mainImage ? (
                        <Image
                          src={mainImage}
                          alt={offer.listing?.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg
                            className="h-8 w-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="sm:col-span-2 flex flex-col justify-between min-h-32">
                      <div>
                        <Link
                          href={`/app/marketplace/${offer.listing?.id}`}
                          className="font-semibold text-gray-900 hover:text-blue-600 transition line-clamp-1"
                        >
                          {offer.listing?.title}
                        </Link>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">
                              {isReceived ? "From" : "To"}:{" "}
                            </span>
                            {otherUser?.username}
                          </p>
                          {offer.message && (
                            <p className="text-sm text-gray-600 line-clamp-1">
                              <span className="font-semibold">Message: </span>
                              {offer.message}
                            </p>
                          )}
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">Listed at: </span>
                            ${(typeof offer.listing?.price === "number" ? offer.listing.price : parseFloat(offer.listing?.price as unknown as string || "0")).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-baseline gap-4">
                        <div>
                          <p className="text-xs text-gray-600">Offered Price</p>
                          <p className="text-xl font-bold text-green-600">
                            ${(typeof offer.offered_price === "number" ? offer.offered_price : parseFloat(offer.offered_price as unknown as string || "0")).toFixed(2)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            STATUS_COLORS[offer.status] || STATUS_COLORS["pending"]
                          }`}
                        >
                          {STATUS_LABELS[offer.status] || offer.status}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="sm:col-span-1 flex flex-col gap-2">
                      <Link
                        href={`/app/marketplace/${offer.listing?.id}`}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                      >
                        View Listing
                      </Link>

                      {isReceived && offer.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleAcceptOffer(offer)}
                            disabled={updatingId === offer.id}
                            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {updatingId === offer.id ? "..." : "Accept"}
                          </button>
                          <button
                            onClick={() => handleDeclineOffer(offer)}
                            disabled={updatingId === offer.id}
                            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                          >
                            {updatingId === offer.id ? "..." : "Decline"}
                          </button>
                        </>
                      )}

                      {!isReceived && offer.status === "pending" && (
                        <p className="text-center text-xs text-gray-600 py-2">
                          Waiting for response...
                        </p>
                      )}

                      {offer.status !== "pending" && (
                        <p className="text-center text-xs font-semibold text-gray-600 py-2">
                          {STATUS_LABELS[offer.status]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No Results */}
        {!loading && offers.length > 0 && filteredOffers.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-600">
              No {tab === "received" ? "received" : "sent"} offers yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
