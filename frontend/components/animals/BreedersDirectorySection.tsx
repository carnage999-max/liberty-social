"use client";

import { useBreedersDirectory } from "@/hooks/useBreedersDirectory";
import { useState } from "react";
import BreederCard from "./BreederCard";

export default function BreedersDirectorySection() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({});
  const { breeders, loading, error, total, refetch } = useBreedersDirectory(filters);

  const filteredBreeders = breeders.filter(
    (breeder) =>
      !searchTerm ||
      breeder.business_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Breeder Directory
        </h1>
        <p className="mt-2 text-gray-600">
          {total} verified breeders • Trusted professionals
        </p>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 sticky top-6">
            <h3 className="font-semibold text-gray-900 mb-4">Filter Breeders</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Years of Experience
                </label>
                <select
                  onChange={(e) =>
                    setFilters({ ...filters, min_years: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Any</option>
                  <option value="1">1+ years</option>
                  <option value="5">5+ years</option>
                  <option value="10">10+ years</option>
                  <option value="20">20+ years</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Minimum Rating
                </label>
                <select
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      min_rating: parseFloat(e.target.value) || undefined,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Any</option>
                  <option value="3">3+ stars</option>
                  <option value="3.5">3.5+ stars</option>
                  <option value="4">4+ stars</option>
                  <option value="4.5">4.5+ stars</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Verification
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        verified_only: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Verified breeders only
                  </span>
                </label>
              </div>

              <button
                onClick={() => setFilters({})}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search Bar */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search by business name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-900 transition hover:bg-gray-50"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
          {loading && !breeders.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-gray-200 h-80 animate-pulse"
                />
              ))}
            </div>
          ) : filteredBreeders.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredBreeders.map((breeder) => (
                  <BreederCard
                    key={breeder.id}
                    id={breeder.id}
                    business_name={breeder.business_name}
                    years_experience={breeder.years_experience}
                    avatar={breeder.avatar}
                    average_rating={breeder.average_rating || 0}
                    reviews_count={breeder.reviews_count || 0}
                    listings_count={breeder.listings_count || 0}
                    is_verified={breeder.is_verified}
                    specialties={breeder.specialties || []}
                    city={breeder.city}
                    state={breeder.state}
                  />
                ))}
              </div>

              {/* Load More */}
              {breeders.length < total && (
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
              <p className="text-gray-600">No breeders found matching your criteria</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
