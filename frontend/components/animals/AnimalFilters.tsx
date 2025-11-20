"use client";

import { useAnimalCategories } from "@/hooks/useAnimalCategories";
import { useState } from "react";

interface AnimalFiltersProps {
  onFiltersChange: (filters: Record<string, any>) => void;
}

export default function AnimalFilters({ onFiltersChange }: AnimalFiltersProps) {
  const { categories, loading } = useAnimalCategories();
  const [filters, setFilters] = useState({
    listing_type: "",
    category_id: "",
    price_min: "",
    price_max: "",
    risk_level: "",
  });

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Convert risk_level to risk_score_min/max for API
    const apiFilters: Record<string, any> = { ...newFilters };
    if (newFilters.risk_level === "low") {
      apiFilters.risk_score_min = 0;
      apiFilters.risk_score_max = 30;
      delete apiFilters.risk_level;
    } else if (newFilters.risk_level === "medium") {
      apiFilters.risk_score_min = 31;
      apiFilters.risk_score_max = 60;
      delete apiFilters.risk_level;
    } else if (newFilters.risk_level === "high") {
      apiFilters.risk_score_min = 61;
      apiFilters.risk_score_max = 100;
      delete apiFilters.risk_level;
    } else {
      delete apiFilters.risk_score_min;
      delete apiFilters.risk_score_max;
      delete apiFilters.risk_level;
    }
    
    onFiltersChange(apiFilters);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Filters</h3>

      {/* Listing Type */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Listing Type
        </label>
        <div className="space-y-2">
          {["sale", "adoption", "rehoming"].map((type) => (
            <label key={type} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="listing_type"
                value={type}
                checked={filters.listing_type === type}
                onChange={(e) => handleFilterChange("listing_type", e.target.value)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700 capitalize">
                {type === "sale" ? "For Sale" : type}
              </span>
            </label>
          ))}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="listing_type"
              value=""
              checked={filters.listing_type === ""}
              onChange={(e) => handleFilterChange("listing_type", e.target.value)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">All Types</span>
          </label>
        </div>
      </div>

      {/* Category */}
      <div className="space-y-3">
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">
          Category
        </label>
        <select
          id="category"
          value={filters.category_id}
          onChange={(e) => handleFilterChange("category_id", e.target.value)}
          disabled={loading}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Price Range
        </label>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 sm:items-center">
          <input
            type="number"
            placeholder="Min price"
            value={filters.price_min}
            onChange={(e) => handleFilterChange("price_min", e.target.value)}
            className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="hidden sm:inline text-gray-500 shrink-0">-</span>
          <input
            type="number"
            placeholder="Max price"
            value={filters.price_max}
            onChange={(e) => handleFilterChange("price_max", e.target.value)}
            className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Risk Level */}
      <div className="space-y-3">
        <label htmlFor="risk_level" className="block text-sm font-medium text-gray-700">
          Risk Level
        </label>
        <select
          id="risk_level"
          value={filters.risk_level}
          onChange={(e) => handleFilterChange("risk_level", e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Risk Levels</option>
          <option value="low">Low Risk (0-30)</option>
          <option value="medium">Medium Risk (31-60)</option>
          <option value="high">High Risk (61-100)</option>
        </select>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => {
          setFilters({
            listing_type: "",
            category_id: "",
            price_min: "",
            price_max: "",
            risk_level: "",
          });
          onFiltersChange({});
        }}
        className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-200"
      >
        Reset Filters
      </button>
    </div>
  );
}
