"use client";

import Image from "next/image";
import Link from "next/link";
import { MarketplaceListing } from "@/lib/types";

interface ListingCardProps {
  listing: MarketplaceListing;
  onImageClick?: () => void;
}

export default function ListingCard({ listing, onImageClick }: ListingCardProps) {
  const mainImage = listing.media && listing.media.length > 0 ? listing.media[0].url : null;
  
  const conditionColors: Record<string, string> = {
    new: "bg-green-100 text-green-800",
    like_new: "bg-blue-100 text-blue-800",
    used: "bg-yellow-100 text-yellow-800",
    fair: "bg-orange-100 text-orange-800",
    poor: "bg-red-100 text-red-800",
  };

  const conditionLabels: Record<string, string> = {
    new: "New",
    like_new: "Like New",
    used: "Used",
    fair: "Fair",
    poor: "Poor",
  };

  const locationLabel = listing.location ? listing.location.split(",")[0] : "Location not specified";
  const categoryName = typeof listing.category === "object" ? listing.category.name : "Category";

  return (
    <Link href={`/app/marketplace/${listing.slug ?? listing.id}`}>
      <div className="group rounded-2xl border border-gray-200 bg-white/90 shadow-sm transition hover:shadow-lg overflow-hidden">
        {/* Image Container */}
        {mainImage ? (
          <div className="relative h-48 w-full overflow-hidden bg-gray-100">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onImageClick?.();
              }}
              className="absolute inset-0 h-full w-full cursor-pointer transition group-hover:brightness-90"
            >
              <Image
                src={mainImage}
                alt={listing.title}
                fill
                className="object-cover"
              />
            </button>
            {/* Media count badge */}
            {listing.media && listing.media.length > 1 && (
              <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
                +{listing.media.length - 1}
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
        <div className="p-4 space-y-3">
          {/* Category & Condition Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {categoryName}
            </span>
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                conditionColors[listing.condition]
              }`}
            >
              {conditionLabels[listing.condition]}
            </span>
          </div>

          {/* Title */}
          <div>
            <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
              {listing.title}
            </h3>
          </div>

          {/* Price */}
          <div className="text-lg font-bold text-gray-900">
            ${parseFloat(listing.price).toFixed(2)}
          </div>

          {/* Location & Details */}
          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="truncate">{locationLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span>{listing.views_count}</span>
            </div>
          </div>

          {/* Seller Info */}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-center gap-2">
              {listing.seller.profile_image_url ? (
                <Image
                  src={listing.seller.profile_image_url}
                  alt={listing.seller.username || listing.seller.first_name}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700">
                  {(listing.seller.username || listing.seller.first_name || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {listing.seller.username ||
                    `${listing.seller.first_name} ${listing.seller.last_name}`.trim()}
                </p>
                {listing.is_verified && (
                  <p className="text-xs text-blue-600 font-medium">Verified seller</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
