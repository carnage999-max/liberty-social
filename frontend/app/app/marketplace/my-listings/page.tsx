"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { MarketplaceListing } from "@/lib/types";
import { apiGet, apiPatch, type PaginatedResponse } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  sold: "bg-gray-100 text-gray-800",
  inactive: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  sold: "Sold",
  inactive: "Inactive",
  cancelled: "Cancelled",
};

interface SoldItem {
  listing: MarketplaceListing;
  offer: any;
  sold_price: string;
  sold_to: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    profile_image_url: string | null;
  };
  sold_date: string;
}

interface CancelledListing extends MarketplaceListing {}

export default function MyListingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, accessToken } = useAuth();

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [soldItems, setSoldItems] = useState<SoldItem[]>([]);
  const [cancelledListings, setCancelledListings] = useState<CancelledListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "sold" | "inactive">("all");
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(new Set());

  // Load listings and sold items
  useEffect(() => {
    const loadData = async () => {
      if (!user || !accessToken) return;

      try {
        // Load active/inactive listings
        const listingsResponse = await apiGet<PaginatedResponse<MarketplaceListing>>(
          `/marketplace/listings/?seller=${user.id}`,
          { token: accessToken }
        );
        setListings(listingsResponse.results || listingsResponse);

        // Load sold items
        const soldResponse = await apiGet<SoldItem[]>(
          `/marketplace/listings/sold_items/`,
          { token: accessToken }
        );
        setSoldItems(Array.isArray(soldResponse) ? soldResponse : []);

        // Load cancelled listings
        const cancelledResponse = await apiGet<PaginatedResponse<CancelledListing>>(
          `/marketplace/listings/cancelled_listings/`,
          { token: accessToken }
        );
        setCancelledListings(cancelledResponse.results || cancelledResponse);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.show("Failed to load data", "error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, accessToken, toast]);

  // Filter listings
  const filteredListings =
    filter === "all"
      ? listings
      : listings.filter((l) => l.status === filter);

  const toggleAccordion = (id: string) => {
    const newAccordions = new Set(expandedAccordions);
    if (newAccordions.has(id)) {
      newAccordions.delete(id);
    } else {
      newAccordions.add(id);
    }
    setExpandedAccordions(newAccordions);
  };

  const handleToggleStatus = async (listing: MarketplaceListing) => {
    setUpdatingId(listing.id);

    try {
      const newStatus = listing.status === "active" ? "inactive" : "active";
      const updated = await apiPatch(
        `/marketplace/listings/${listing.id}/`,
        { status: newStatus },
        { token: accessToken }
      );

      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? updated : l))
      );

      const action = newStatus === "active" ? "activated" : "deactivated";
      toast.show(`Listing ${action}`, "success");
    } catch (error) {
      console.error("Failed to update listing status:", error);
      toast.show("Failed to update listing status", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkAsSold = async (listing: MarketplaceListing) => {
    setUpdatingId(listing.id);

    try {
      const updated = await apiPatch(
        `/marketplace/listings/${listing.id}/`,
        { status: "sold" },
        { token: accessToken }
      );

      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? updated : l))
      );

      toast.show("Listing marked as sold", "success");
    } catch (error) {
      console.error("Failed to mark listing as sold:", error);
      toast.show("Failed to mark listing as sold", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkAsCancelled = async (listing: MarketplaceListing) => {
    setUpdatingId(listing.id);

    try {
      const updated = await apiPatch(
        `/marketplace/listings/${listing.id}/`,
        { status: "cancelled" },
        { token: accessToken }
      );

      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? updated : l))
      );

      // Reload the cancelled listings accordion
      const response = await apiGet<any>(
        `/marketplace/listings/cancelled_listings/`,
        { token: accessToken }
      );
      setCancelledListings(response.results || response);

      toast.show("Listing cancelled", "success");
    } catch (error) {
      console.error("Failed to cancel listing:", error);
      toast.show("Failed to cancel listing", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Check authentication
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to view your listings</p>
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
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-black">My Listings</h1>
            <p className="text-gray-600 mt-1">
              Manage your marketplace listings ({listings.length} total)
            </p>
          </div>
          <Link
            href="/app/marketplace/create"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Listing
          </Link>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your listings...</p>
            </div>
          </div>
        )}

        {/* Sold Items Accordion */}
        {!loading && soldItems.length > 0 && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => toggleAccordion("sold-items")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <h3 className="font-semibold text-gray-900">
                Items Sold ({soldItems.length})
              </h3>
              <svg
                className={`h-5 w-5 text-gray-600 transition-transform ${
                  expandedAccordions.has("sold-items") ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </button>
            {expandedAccordions.has("sold-items") && (
              <div className="border-t border-gray-200 p-4 space-y-3">
                {soldItems.map((item) => (
                  <div
                    key={`sold-${item.listing.id}`}
                    className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition"
                  >
                    <div className="flex gap-4">
                      {/* Listing Image */}
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {item.listing.media?.[0]?.url ? (
                          <Image
                            src={item.listing.media[0].url}
                            alt={item.listing.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg
                              className="h-6 w-6"
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
                      </div>

                      {/* Item Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {item.listing.title}
                        </p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p className="text-gray-600">
                            Sold to:{" "}
                            <span className="font-medium text-gray-900">
                              {item.sold_to?.username || item.sold_to?.first_name || "Unknown"}
                            </span>
                          </p>
                          <p className="text-gray-600">
                            Price:{" "}
                            <span className="font-semibold text-gray-900">
                              ${parseFloat(String(item.sold_price) || "0").toFixed(2)}
                            </span>
                          </p>
                          <p className="text-gray-500 text-xs">
                            {new Date(item.sold_date).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cancelled Listings Accordion */}
        {!loading && cancelledListings.length > 0 && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => toggleAccordion("cancelled-listings")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <h3 className="font-semibold text-gray-900">
                Listings Cancelled ({cancelledListings.length})
              </h3>
              <svg
                className={`h-5 w-5 text-gray-600 transition-transform ${
                  expandedAccordions.has("cancelled-listings") ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </button>
            {expandedAccordions.has("cancelled-listings") && (
              <div className="border-t border-gray-200 p-4 space-y-3">
                {cancelledListings.map((listing) => {
                  const mainImage = listing.media?.[0]?.url;
                  return (
                    <div
                      key={`cancelled-${listing.id}`}
                      className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition"
                    >
                      <div className="flex gap-4">
                        {/* Listing Image */}
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          {mainImage ? (
                            <Image
                              src={mainImage}
                              alt={listing.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <svg
                                className="h-6 w-6"
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
                        </div>

                        {/* Listing Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {listing.title}
                          </p>
                          <div className="mt-2 space-y-1 text-sm">
                            <p className="text-gray-600">
                              Price:{" "}
                              <span className="font-semibold text-gray-900">
                                ${parseFloat(String(listing.price) || "0").toFixed(2)}
                              </span>
                            </p>
                            <p className="text-gray-500 text-xs">
                              Cancelled:{" "}
                              {new Date(listing.updated_at).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Filter Tabs */}
        {!loading && listings.length > 0 && (
          <div className="mb-6 border-b border-gray-200">
            <div className="flex gap-6 overflow-x-auto">
              {[
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "sold", label: "Sold" },
                { id: "inactive", label: "Inactive" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id as any)}
                  className={`px-4 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition ${
                    filter === id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && listings.length === 0 && (
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
                d="M16 8a4 4 0 11-8 0 4 4 0 018 0M12 14v6m-4-3h8"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No listings yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start selling by creating your first listing
            </p>
            <Link
              href="/app/marketplace/create"
              className="inline-block px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Create First Listing
            </Link>
          </div>
        )}

        {/* Listings Grid */}
        {!loading && filteredListings.length > 0 && (
          <div className="space-y-3">
            {filteredListings.map((listing) => {
              const mainImage = listing.media?.[0]?.url;

              return (
                <div
                  key={listing.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-gray-300 transition"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* Image */}
                    <Link
                      href={`/app/marketplace/${listing.id}`}
                      className="sm:col-span-1 relative h-32 sm:h-40 rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition shrink-0"
                    >
                      {mainImage ? (
                        <Image
                          src={mainImage}
                          alt={listing.title}
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
                          href={`/app/marketplace/${listing.id}`}
                          className="font-semibold text-gray-900 hover:text-blue-600 transition line-clamp-2"
                        >
                          {listing.title}
                        </Link>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              STATUS_COLORS[listing.status] || STATUS_COLORS["active"]
                            }`}
                          >
                            {STATUS_LABELS[listing.status] || listing.status}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                            {typeof listing.category === "object" ? listing.category.name : "Category"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-baseline gap-4">
                        <div>
                          <p className="text-xs text-gray-600">Price</p>
                          <p className="text-xl font-bold text-gray-900">
                            ${(typeof listing.price === "number" ? listing.price : parseFloat(listing.price as unknown as string || "0")).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Views</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {(listing as any).views_count || (listing as any).views || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="sm:col-span-1 flex flex-col gap-2">
                      <Link
                        href={`/app/marketplace/${listing.id}`}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                      >
                        View
                      </Link>
                      <Link
                        href={`/app/marketplace/${listing.id}/edit`}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                      >
                        Edit
                      </Link>

                      {listing.status === "active" ? (
                        <>
                          <button
                            onClick={() => handleMarkAsSold(listing)}
                            disabled={updatingId === listing.id}
                            className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {updatingId === listing.id ? "..." : "Sold"}
                          </button>
                          <button
                            onClick={() => handleToggleStatus(listing)}
                            disabled={updatingId === listing.id}
                            className="flex-1 rounded-lg bg-yellow-600 px-3 py-2 text-sm font-semibold text-white hover:bg-yellow-700 transition disabled:opacity-50"
                          >
                            {updatingId === listing.id ? "..." : "Hide"}
                          </button>
                          <button
                            onClick={() => handleMarkAsCancelled(listing)}
                            disabled={updatingId === listing.id}
                            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                          >
                            {updatingId === listing.id ? "..." : "Cancel"}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(listing)}
                          disabled={updatingId === listing.id}
                          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {updatingId === listing.id ? "..." : "Activate"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No Results */}
        {!loading && listings.length > 0 && filteredListings.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-600">
              No {filter !== "all" ? filter : ""} listings found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
