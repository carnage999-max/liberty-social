"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getBreederProfile, getBreederListings } from "@/lib/animals";
import { useToast } from "@/components/Toast";
import AnimalListingCard from "./AnimalListingCard";
import Link from "next/link";

interface BreederDetailProps {
  id: string;
}

export default function BreederDetail({ id }: BreederDetailProps) {
  const { show: showToast } = useToast();
  const [breeder, setBreeder] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    subject: "",
    message: "",
    phone: "",
  });

  useEffect(() => {
    loadBreederData();
  }, [id]);

  const loadBreederData = async () => {
    try {
      setLoading(true);
      const profile = await getBreederProfile(id);
      setBreeder(profile);

      const breederListings = await getBreederListings(id);
      setListings(breederListings);
    } catch (error) {
      showToast("Failed to load breeder details", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Contact API call would go here
      showToast("Message sent to breeder", "success");
      setContactFormOpen(false);
      setContactForm({ subject: "", message: "", phone: "" });
    } catch (error) {
      showToast("Failed to send message", "error");
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="rounded-2xl bg-gray-200 h-40 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!breeder) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Breeder not found</p>
      </div>
    );
  }

  const totalReviews = breeder.reviews_count || 0;
  const averageRating = breeder.average_rating || 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/app/breeders" className="hover:text-gray-900">
          Breeders
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{breeder.business_name}</span>
      </div>

      {/* Header Section */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {/* Background Banner */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-blue-600" />

        {/* Content */}
        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between -mt-16 gap-4 mb-6">
            <div className="flex items-end gap-4">
              {breeder.avatar && (
                <Image
                  src={breeder.avatar}
                  alt={breeder.business_name}
                  width={120}
                  height={120}
                  className="rounded-full border-4 border-white"
                />
              )}
              <div className="pb-2">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {breeder.business_name}
                </h1>
                {breeder.is_verified && (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-1 text-green-800 text-sm font-medium">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                    Verified Breeder
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setContactFormOpen(!contactFormOpen)}
              className="rounded-lg btn-primary px-6 py-2.5 font-medium text-white transition hover:opacity-90"
            >
              Contact Breeder
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-2xl font-bold text-gray-900">
                {breeder.years_experience}
              </div>
              <div className="text-sm text-gray-600">Years of Experience</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-gray-900">
                  {averageRating.toFixed(1)}
                </span>
                <span className="text-yellow-500 text-xl">★</span>
              </div>
              <div className="text-sm text-gray-600">{totalReviews} reviews</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-2xl font-bold text-gray-900">
                {breeder.listings_count || 0}
              </div>
              <div className="text-sm text-gray-600">Active Listings</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-2xl font-bold text-gray-900">
                {breeder.total_sold || 0}
              </div>
              <div className="text-sm text-gray-600">Sold</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* About Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">About</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {breeder.bio || "No bio provided"}
            </p>
          </div>

          {/* Specialties */}
          {breeder.specialties && breeder.specialties.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Specialties
              </h2>
              <div className="flex flex-wrap gap-2">
                {breeder.specialties.map((specialty: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-block rounded-full bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Information */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Information
            </h2>
            <div className="space-y-3">
              {breeder.city && breeder.state && (
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-medium text-gray-900">
                      {breeder.city}, {breeder.state}
                    </p>
                  </div>
                </div>
              )}

              {breeder.phone && (
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773c.26.559.738 1.559 2.318 3.138 1.58 1.58 2.58 2.058 3.138 2.318l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2.57c-8.835 0-16-7.165-16-16V3z" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium text-gray-900">{breeder.phone}</p>
                  </div>
                </div>
              )}

              {breeder.website && (
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.25 5.5a.75.75 0 00-.5.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0113.25 15h-8.5A2.25 2.25 0 012.5 12.75v-8.5A2.25 2.25 0 014.75 2h5a.75.75 0 010 1.5h-5z"
                      clipRule="evenodd"
                    />
                    <path
                      fillRule="evenodd"
                      d="M6.194 12.753a.75.75 0 001.06.053l4-4.5a.75.75 0 00-1.113-1.007l-4 4.5a.75.75 0 00.053 1.06z"
                      clipRule="evenodd"
                    />
                    <path
                      fillRule="evenodd"
                      d="M13 3a.75.75 0 00-.75.75v2.5a.75.75 0 001.5 0v-2.5A.75.75 0 0013 3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-600">Website</p>
                    <a
                      href={breeder.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:text-blue-700"
                    >
                      Visit Website
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Listings */}
          {listings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Active Listings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    location={`${listing.city}, ${listing.state}`}
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
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Contact Form */}
          {contactFormOpen && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sticky top-6">
              <h3 className="font-semibold text-gray-900 mb-4">Send Message</h3>
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, subject: e.target.value })
                    }
                    placeholder="What would you like to know?"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Your Phone
                  </label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phone: e.target.value })
                    }
                    placeholder="(555) 123-4567"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Message
                  </label>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, message: e.target.value })
                    }
                    placeholder="Tell us more about your inquiry..."
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none resize-none"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-lg btn-primary px-4 py-2 font-medium text-white transition hover:opacity-90"
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactFormOpen(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-900 transition hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Trust Badge */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Trust & Safety</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span className="text-gray-700">Identity verified</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span className="text-gray-700">Seller ratings available</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span className="text-gray-700">Secure messaging</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span className="text-gray-700">Report capability</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
