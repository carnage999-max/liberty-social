"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

interface AnimalListingCardProps {
  id: string;
  title: string;
  breed: string;
  category: {
    id: string;
    name: string;
  };
  price?: number;
  listing_type: "sale" | "adoption" | "rehoming";
  location: string;
  animal_listing_media?: Array<{
    id: string;
    url: string;
  }>;
  status: string;
  risk_score?: number;
  seller?: {
    username: string;
    verification?: {
      status: string;
    };
  };
  seller_verified?: boolean;
  has_vet_documentation?: boolean;
}

export default function AnimalListingCard({
  id,
  title,
  breed,
  category,
  price,
  listing_type,
  location,
  animal_listing_media,
  status,
  risk_score,
  seller,
  seller_verified,
  has_vet_documentation,
}: AnimalListingCardProps) {
  const imageUrl = animal_listing_media?.[0]?.url || null;
  const isHighRisk = risk_score && risk_score > 60;
  const isVerified = seller_verified || seller?.verification?.status === "verified";
  const hasVetDocs = typeof has_vet_documentation !== "undefined" ? has_vet_documentation : true;
  const isUnverified = !isVerified || !hasVetDocs;

  const getPriceDisplay = () => {
    if (listing_type === "adoption") {
      return "Free - Adoption";
    }
    if (listing_type === "rehoming") {
      return "Rehoming";
    }
    return price ? `$${price.toLocaleString()}` : "Contact for price";
  };

  const getListingTypeColor = () => {
    switch (listing_type) {
      case "sale":
        return "bg-blue-100 text-blue-800";
      case "adoption":
        return "bg-green-100 text-green-800";
      case "rehoming":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Link href={`/app/animals/${id}`}>
      <div className="group rounded-2xl border border-gray-200 bg-white/90 shadow-sm transition hover:shadow-lg overflow-hidden h-full flex flex-col">
        {/* Image Container */}
        {imageUrl ? (
          <div className="relative h-48 w-full overflow-hidden bg-gray-100">
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-cover transition group-hover:brightness-90"
            />
            {/* Risk Badge */}
            {isHighRisk && (
              <div className="absolute top-2 right-2 rounded-full bg-red-500/90 px-2.5 py-1.5 text-xs font-semibold text-white flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                Risk
              </div>
            )}
            {/* Verified Seller Badge */}
            {isVerified && !isUnverified && (
              <div className="absolute top-2 left-2 rounded-full bg-green-500/90 px-2.5 py-1.5 text-xs font-semibold text-white flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                Verified
              </div>
            )}

            {/* Unverified Badge (missing verification or vet docs) */}
            {isUnverified && (
              <div className="absolute top-2 left-2 rounded-full bg-yellow-500/95 px-2.5 py-1.5 text-xs font-semibold text-white flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                Unverified
              </div>
            )}
            {/* Media count badge */}
            {animal_listing_media && animal_listing_media.length > 1 && (
              <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
                +{animal_listing_media.length - 1}
              </div>
            )}
          </div>
        ) : (
          <div className="relative h-48 w-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <svg
              className="h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-3 flex-1 flex flex-col">
          {/* Category & Type Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {category.name}
            </span>
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${getListingTypeColor()}`}
            >
              {listing_type === "sale" ? "For Sale" : listing_type.charAt(0).toUpperCase() + listing_type.slice(1)}
            </span>
          </div>

          {/* Title */}
          <div>
            <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
              {title}
            </h3>
            <p className="text-xs text-gray-600 mt-1">{breed}</p>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span className="line-clamp-1">{location}</span>
          </div>

          {/* Footer: Price, Risk Score & Status */}
          <div className="mt-auto space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-blue-600">
                {getPriceDisplay()}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700 capitalize">
                {status}
              </span>
            </div>
            
            {/* Risk Score Indicator */}
            {risk_score !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Risk Score</span>
                <div className="flex items-center gap-2">
                  <div className="relative w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        risk_score <= 30
                          ? "bg-green-500"
                          : risk_score <= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${risk_score}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold ${
                    risk_score <= 30
                      ? "text-green-600"
                      : risk_score <= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}>
                    {risk_score}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
