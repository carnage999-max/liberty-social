"use client";

import { useCallback, useState } from "react";
import type { MarketplaceCategory, ListingCondition } from "@/lib/types";

interface FilterState {
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  condition?: ListingCondition;
  location?: string;
  search?: string;
}

interface FilterSidebarProps {
  categories: MarketplaceCategory[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch: (query: string) => void;
  loading?: boolean;
}

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "used", label: "Used" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

export default function FilterSidebar({
  categories,
  filters,
  onFiltersChange,
  onSearch,
  loading = false,
}: FilterSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["category", "price", "condition"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleCategoryChange = useCallback(
    (slug: string) => {
      onFiltersChange({
        ...filters,
        category: filters.category === slug ? undefined : slug,
      });
    },
    [filters, onFiltersChange]
  );

  const handleConditionChange = useCallback(
    (condition: ListingCondition) => {
      onFiltersChange({
        ...filters,
        condition: filters.condition === condition ? undefined : condition,
      });
    },
    [filters, onFiltersChange]
  );

  const handlePriceChange = useCallback(
    (type: "min" | "max", value: string) => {
      onFiltersChange({
        ...filters,
        [type === "min" ? "minPrice" : "maxPrice"]: value || undefined,
      });
    },
    [filters, onFiltersChange]
  );

  const handleLocationChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        location: value || undefined,
      });
    },
    [filters, onFiltersChange]
  );

  const clearFilters = () => {
    onFiltersChange({});
    onSearch("");
  };

  const hasActiveFilters = !!(
    filters.category ||
    filters.condition ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.location ||
    filters.search
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm space-y-4">
      {/* Search Box */}
      <div>
        <input
          type="text"
          placeholder="Search listings..."
          defaultValue={filters.search || ""}
          onChange={(e) => onSearch(e.target.value)}
          disabled={loading}
          className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700 disabled:opacity-50"
        />
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          disabled={loading}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
        >
          Clear Filters
        </button>
      )}

      {/* Category Filter */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => toggleSection("category")}
          className="flex w-full items-center justify-between"
          disabled={loading}
        >
          <h3 className="text-sm font-semibold text-gray-900">Category</h3>
          <svg
            className={`h-4 w-4 transition ${
              expandedSections.has("category") ? "rotate-180" : ""
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
        {expandedSections.has("category") && (
          <div className="mt-3 space-y-2">
            {categories.map((cat) => (
              <label key={cat.slug} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.category === cat.slug}
                  onChange={() => handleCategoryChange(cat.slug)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700">{cat.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Price Filter */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => toggleSection("price")}
          className="flex w-full items-center justify-between"
          disabled={loading}
        >
          <h3 className="text-sm font-semibold text-gray-900">Price Range</h3>
          <svg
            className={`h-4 w-4 transition ${
              expandedSections.has("price") ? "rotate-180" : ""
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
        {expandedSections.has("price") && (
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Min Price</label>
              <input
                type="number"
                placeholder="$0"
                value={filters.minPrice || ""}
                onChange={(e) => handlePriceChange("min", e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700 disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Max Price</label>
              <input
                type="number"
                placeholder="$10000"
                value={filters.maxPrice || ""}
                onChange={(e) => handlePriceChange("max", e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700 disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Condition Filter */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => toggleSection("condition")}
          className="flex w-full items-center justify-between"
          disabled={loading}
        >
          <h3 className="text-sm font-semibold text-gray-900">Condition</h3>
          <svg
            className={`h-4 w-4 transition ${
              expandedSections.has("condition") ? "rotate-180" : ""
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
        {expandedSections.has("condition") && (
          <div className="mt-3 space-y-2">
            {CONDITIONS.map((cond) => (
              <label key={cond.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.condition === (cond.value as ListingCondition)}
                  onChange={() => handleConditionChange(cond.value as ListingCondition)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700">{cond.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Location Filter */}
      <div className="border-t border-gray-200 pt-4">
        <label className="text-sm font-semibold text-gray-900 block mb-2">Location</label>
        <input
          type="text"
          placeholder="City or region..."
          value={filters.location || ""}
          onChange={(e) => handleLocationChange(e.target.value)}
          disabled={loading}
          className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
