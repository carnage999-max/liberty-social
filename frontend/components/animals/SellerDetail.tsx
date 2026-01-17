"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getAnimalListings } from "@/lib/animals";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import AnimalListingCard from "./AnimalListingCard";

interface SellerDetailProps {
  sellerId: string;
}

export default function SellerDetail({ sellerId }: SellerDetailProps) {
  const { show: showToast } = useToast();
  const [seller, setSeller] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSellerData();
  }, [sellerId]);

  const loadSellerData = async () => {
    try {
      setLoading(true);
      // Fetch listings for this seller
      const listingsData = await getAnimalListings({ seller_id: sellerId });
      const listingsArray = Array.isArray(listingsData) ? listingsData : (listingsData.results || []);
      setListings(listingsArray);

      // Extract seller info from the first listing
      if (listingsArray.length > 0) {
        setSeller(listingsArray[0].seller);
      }
    } catch (error) {
      console.error("Failed to load seller data:", error);
      showToast("Failed to load seller profile", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-20 bg-gray-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-80 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Seller not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/app/animals" className="hover:text-gray-900">
          Animals
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Sellers</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">{seller.id}</span>
      </div>

      {/* Seller Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {seller.profile_image_url ? (
              <Image
                src={seller.profile_image_url}
                alt={seller.display_name}
                width={200}
                height={200}
                className="rounded-full object-cover border-4 border-blue-100"
              />
            ) : (
              <div className="w-48 h-48 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-5xl font-bold">
                {seller.display_name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Seller Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              {seller.display_name}
            </h1>
            <p className="text-lg text-gray-600 mb-4">@{seller.username}</p>

            {/* Rating */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl text-yellow-400">★</span>
                <span className="text-lg font-semibold text-gray-900">
                  {seller.average_rating?.toFixed(1) || "N/A"}
                </span>
                <span className="text-gray-600">
                  ({seller.reviews_count || 0} reviews)
                </span>
              </div>
              {seller.is_verified && (
                <div className="flex items-center gap-2 rounded-lg bg-green-100 px-3 py-1 text-green-800 text-sm font-medium">
                  ✓ Verified Seller
                </div>
              )}
            </div>

            {/* Bio */}
            {seller.bio && (
              <p className="text-gray-700 mb-6 leading-relaxed">
                {seller.bio}
              </p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="text-2xl font-bold text-blue-900">
                  {listings.length}
                </div>
                <div className="text-sm text-blue-700">Active Listings</div>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="text-2xl font-bold text-green-900">
                  {seller.reviews_count || 0}
                </div>
                <div className="text-sm text-green-700">Total Reviews</div>
              </div>
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
                <div className="text-2xl font-bold text-purple-900">
                  {seller.average_rating?.toFixed(1) || "N/A"}
                </div>
                <div className="text-sm text-purple-700">Avg Rating</div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-2 text-sm">
              <div className="text-gray-600">
                <span className="font-medium">Email:</span> {seller.email}
              </div>
              {seller.phone && (
                <div className="text-gray-600">
                  <span className="font-medium">Phone:</span> {seller.phone}
                </div>
              )}
              {seller.location && (
                <div className="text-gray-600">
                  <span className="font-medium">Location:</span> {seller.location}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Seller's Listings */}
      {listings.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {seller.username}'s Listings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <AnimalListingCard
                key={listing.id}
                id={listing.id}
                slug={listing.slug}
                title={listing.title}
                breed={listing.breed}
                category={listing.category}
                price={listing.price}
                listing_type={listing.listing_type}
                location={`${listing.location}`}
                animal_listing_media={listing.animal_listing_media}
                status={listing.status}
                risk_score={listing.risk_score}
                seller={listing.seller}
                seller_verified={listing.seller_verified}
                has_vet_documentation={listing.has_vet_documentation}
              />
            ))}
          </div>
        </div>
      )}

      {listings.length === 0 && (
        <div className="text-center py-12 rounded-2xl border border-gray-200 bg-white/50">
          <p className="text-gray-600">No active listings from this seller</p>
        </div>
      )}
    </div>
  );
}
