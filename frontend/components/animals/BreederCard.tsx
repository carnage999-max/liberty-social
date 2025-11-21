"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BreederCardProps {
  id: string;
  business_name: string;
  years_experience: number;
  avatar?: string;
  average_rating: number;
  reviews_count: number;
  listings_count: number;
  is_verified: boolean;
  specialties?: string[];
  city?: string;
  state?: string;
}

export default function BreederCard({
  id,
  business_name,
  years_experience,
  avatar,
  average_rating,
  reviews_count,
  listings_count,
  is_verified,
  specialties = [],
  city,
  state,
}: BreederCardProps) {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition">
      {/* Header with Background */}
      <div className="h-24 bg-gradient-to-r from-blue-500 to-blue-600" />

      {/* Content */}
      <div className="px-6 pb-6">
        {/* Avatar */}
        <div className="flex items-start justify-between -mt-12 mb-4">
          {avatar ? (
            <Image
              src={avatar}
              alt={business_name}
              width={80}
              height={80}
              className="rounded-full border-4 border-white"
            />
          ) : (
            <div className="w-20 h-20 rounded-full border-4 border-white bg-gray-200 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
          {is_verified && (
            <div className="rounded-full bg-green-500 text-white p-2 flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>
          )}
        </div>

        {/* Business Name */}
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {business_name}
        </h3>

        {/* Experience */}
        <p className="text-sm text-gray-600 mb-4">
          {years_experience} years of experience
        </p>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center">
            <span className="text-yellow-500">★</span>
            <span className="font-semibold text-gray-900 ml-1">
              {average_rating.toFixed(1)}
            </span>
          </div>
          <span className="text-sm text-gray-600">({reviews_count} reviews)</span>
        </div>

        {/* Specialties */}
        {specialties.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {specialties.slice(0, 3).map((specialty, idx) => (
                <span
                  key={idx}
                  className="inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-gray-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{listings_count}</p>
            <p className="text-xs text-gray-600">Active Listings</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {years_experience}
            </p>
            <p className="text-xs text-gray-600">Years</p>
          </div>
        </div>

        {/* Location */}
        {city && state && (
          <p className="text-sm text-gray-600 mb-4 flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
            {city}, {state}
          </p>
        )}

        {/* Action Button */}
        <Link
          href={`/app/breeders/${id}`}
          className="block w-full text-center rounded-lg btn-primary px-4 py-2.5 font-medium text-white transition hover:opacity-90"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}
