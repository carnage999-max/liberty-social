"use client";

import { useAuth } from "@/lib/auth-context";
import { apiGet, type PaginatedResponse } from "@/lib/api";
import type { MarketplaceListing, MarketplaceCategory, ListingCondition } from "@/lib/types";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import ListingCard from "@/components/marketplace/ListingCard";
import FilterSidebar from "@/components/marketplace/FilterSidebar";
import Gallery from "@/components/Gallery";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

interface FilterState {
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  condition?: ListingCondition;
  location?: string;
  search?: string;
}

export default function MarketplacePage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [pagination, setPagination] = useState<
    Pick<PaginatedResponse<MarketplaceListing>, "count" | "next">
  >({ count: 0, next: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState<{ listingId: number; index: number } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await apiGet<PaginatedResponse<MarketplaceCategory>>(
          "/marketplace/listings?category=__init__" // This won't work, need better approach
        );
        // For now, we'll load categories separately
        // Assuming an endpoint exists, adjust as needed
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    };
    loadCategories();
  }, []);

  // Load listings when filters change
  useEffect(() => {
    loadListings(true);
  }, [filters]);

  const loadListings = useCallback(
    async (reset = false, url?: string, append = false) => {
      if (!accessToken) return;
      const controller = new AbortController();
      controllerRef.current?.abort();
      controllerRef.current = controller;

      (append ? setLoadingMore : setLoading)(true);
      setError(null);

      try {
        let apiUrl: string;
        if (!url) {
          const params = new URLSearchParams();
          if (filters.search) params.append("search", filters.search);
          if (filters.category) params.append("category", filters.category);
          if (filters.minPrice) params.append("min_price", filters.minPrice);
          if (filters.maxPrice) params.append("max_price", filters.maxPrice);
          if (filters.condition) params.append("condition", filters.condition);
          if (filters.location) params.append("location", filters.location);

          apiUrl = `/marketplace/listings/?${params.toString()}`;
        } else {
          apiUrl = url;
        }

        const data = await apiGet<PaginatedResponse<MarketplaceListing>>(apiUrl, {
          token: accessToken,
          signal: controller.signal,
        });

        if (append && url) {
          setListings((prev) => [...prev, ...data.results]);
        } else {
          setListings(data.results);
        }

        setPagination({ count: data.count, next: data.next });
      } catch (err: any) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError(err.message || "Failed to load listings");
        toast.show("Failed to load listings", "error");
      } finally {
        (append ? setLoadingMore : setLoading)(false);
      }
    },
    [accessToken, filters, toast]
  );

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleSearch = (query: string) => {
    setFilters((prev) => ({
      ...prev,
      search: query || undefined,
    }));
  };

  const handleLoadMore = () => {
    if (pagination.next) {
      loadListings(false, pagination.next, true);
    }
  };

  const galleryImages = useMemo(() => {
    if (!galleryOpen) return [];
    const listing = listings.find((l) => l.id === galleryOpen.listingId);
    return listing?.media?.map((m) => m.url) || [];
  }, [listings, galleryOpen]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
          <p className="text-sm text-gray-600 mt-1">
            {pagination.count === 0
              ? "No listings available"
              : `${pagination.count} listing${pagination.count === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/marketplace/my-listings"
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8m3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5m-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11m3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
            My Listings
          </Link>
          <Link
            href="/app/marketplace/offers"
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h18v18H3V3m1 1v16h16V4H4m6 3h6m-6 4h6m-6 4h3" />
            </svg>
            Offers
          </Link>
          <Link
            href="/app/marketplace/create"
            className="inline-flex items-center gap-2 rounded-full bg-(--color-deep-navy) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--color-deeper-navy)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14m-7-7h14" />
            </svg>
            List Item
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-4 lg:grid-cols-5">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <FilterSidebar
            categories={categories}
            filters={filters}
            onFiltersChange={handleFilterChange}
            onSearch={handleSearch}
            loading={loading}
          />
        </div>

        {/* Listings Grid */}
        <div className="md:col-span-3 lg:col-span-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-white/90 p-8 text-center shadow-sm">
              <p className="text-sm text-gray-700">{error}</p>
              <button
                onClick={() => loadListings(true)}
                className="mt-4 rounded-lg bg-(--color-deep-navy) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--color-deeper-navy)"
              >
                Retry
              </button>
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800">No listings found</h2>
              <p className="mt-2 text-sm text-gray-500">
                Try adjusting your filters or check back later.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onImageClick={() => {
                      if (listing.media && listing.media.length > 0) {
                        setGalleryOpen({ listingId: listing.id, index: 0 });
                      }
                    }}
                  />
                ))}
              </div>

              {pagination.next && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="rounded-lg border border-(--color-deep-navy) px-5 py-2 text-sm font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white disabled:opacity-60"
                  >
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Gallery Modal */}
      <Gallery
        isOpen={galleryOpen !== null}
        onClose={() => setGalleryOpen(null)}
        images={galleryImages}
        initialIndex={galleryOpen?.index || 0}
      />
    </div>
  );
}
