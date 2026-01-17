"use client";

import { useAnimalListings } from "@/hooks/useAnimalListings";
import { useState } from "react";
import AnimalListingCard from "./AnimalListingCard";
import AnimalFilters from "./AnimalFilters";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function AnimalListingsSection() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [filters, setFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const { listings, loading, error, total, refetch } = useAnimalListings(filters);

  const handleCreateListing = () => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    router.push("/app/animals/create");
  };

  const displayedListings = listings.filter((listing) =>
    !searchTerm ||
    listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    listing.breed.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Animal Marketplace
          </h1>
          <p className="mt-2 text-gray-600">
            {total} listings • Safe, verified sellers
          </p>
        </div>
        <button
          onClick={handleCreateListing}
          className="inline-flex items-center gap-2 rounded-lg btn-primary px-4 py-2.5 font-semibold text-white transition hover:opacity-90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          List Your Animal
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6">
        {/* Filters: stack above listings on mobile, sidebar on desktop */}
        <div className="w-full lg:col-span-1 lg:w-auto mb-4 lg:mb-0">
          <AnimalFilters onFiltersChange={setFilters} />
        </div>

        {/* Main Content */}
        <div className="w-full lg:col-span-3 space-y-6">
          {/* Search Bar */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search by breed, name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-900 transition hover:bg-gray-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36"></path>
              </svg>
              Refresh
            </button>
          </div>

          {/* Error State */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && !listings.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-gray-200 h-80 animate-pulse"
                />
              ))}
            </div>
          ) : displayedListings.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {displayedListings.map((listing) => (
                  <AnimalListingCard
                    key={listing.id}
                    id={listing.id}
                    slug={listing.slug}
                    title={listing.title}
                    breed={listing.breed}
                    category={listing.category}
                    price={listing.price}
                    listing_type={listing.listing_type}
                    location={listing.location}
                    animal_listing_media={listing.animal_listing_media}
                    status={listing.status}
                    risk_score={listing.risk_score}
                    seller={listing.seller}
                    seller_verified={listing.seller_verified}
                    has_vet_documentation={listing.has_vet_documentation}
                  />
                ))}
              </div>

              {/* Load More */}
              {listings.length < total && (
                <div className="text-center pt-6">
                  <button
                    onClick={() => refetch()}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-6 py-2.5 font-medium text-gray-900 transition hover:bg-gray-200"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 rounded-2xl border border-gray-200 bg-white/50">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-gray-600 mb-4">No listings found</p>
              <button
                onClick={handleCreateListing}
                className="inline-flex items-center gap-2 rounded-lg btn-primary px-6 py-2.5 font-medium text-white transition hover:opacity-90"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create First Listing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
