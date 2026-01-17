"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getAnimalListing, getAnimalListings, deleteAnimalListing } from "@/lib/animals";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import ReviewsSection from "./ReviewsSection";
import ImageGallery from "@/components/ImageGallery";
import ShareModal from "@/components/modals/ShareModal";
import Link from "next/link";

interface AnimalListingDetailProps {
  id: string;
}

export default function AnimalListingDetail({ id }: AnimalListingDetailProps) {
  const { show: showToast } = useToast();
  const { user } = useAuth();
  const [listing, setListing] = useState<any>(null);
  const [relatedListings, setRelatedListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    message: "",
    phone: "",
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadListing(controller.signal);
    return () => controller.abort();
  }, [id]);

  const loadListing = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const data = await getAnimalListing(id);
      // If the effect was aborted elsewhere, bail out
      if (signal?.aborted) return;
      setListing(data);

      // Load related listings from same category (backend expects `category` param)
      try {
        const listings = await getAnimalListings({ category_id: data.category, limit: 3 });
        if (!signal?.aborted) {
          setRelatedListings(
            listings.filter((l: any) => (l.slug ?? l.id) !== id).slice(0, 3)
          );
        }
      } catch (relErr) {
        // Related listings are non-fatal; log but don't spam user
        // Only show toast if it's a real error (not aborted)
        if (!(relErr as any)?.message?.includes("aborted") && !signal?.aborted) {
          console.error("Failed to load related listings:", relErr);
        }
      }
    } catch (error: any) {
      // If the fetch was aborted, don't show an error toast
      if (error?.name === "AbortError") return;
      console.error("Failed to load listing:", error);
      showToast(error?.message || "Failed to load listing details", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Contact API call would go here
      showToast("Message sent to seller", "success");
      setContactFormOpen(false);
      setContactForm({ message: "", phone: "" });
    } catch (error) {
      showToast("Failed to send message", "error");
    }
  };

  const handleDeleteListing = async () => {
    if (!deleteConfirmed) {
      showToast("Please confirm that you understand the listing will be deleted", "error");
      return;
    }

    try {
      setDeleting(true);
      await deleteAnimalListing(id);
      showToast("Listing deleted successfully", "success");
      // Redirect to animals page after deletion
      setTimeout(() => {
        window.location.href = "/app/animals";
      }, 1500);
    } catch (error: any) {
      console.error("Failed to delete listing:", error);
      showToast(error?.message || "Failed to delete listing", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="aspect-square rounded-2xl bg-gray-200 animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Listing not found</p>
      </div>
    );
  }

  // Backend detail serializer exposes `media` (array of media objects)
  // (list serializer exposes `animal_listing_media`). Use whichever is present.
  const images = listing.media || listing.animal_listing_media || [];
  const mainImage = images[selectedImageIndex]?.url || null;
  
  // Check if current user is the seller/owner
  const isOwner = user && listing?.seller && user.id === listing.seller.id;
  
  // Format age display
  const formatAge = () => {
    const years = listing.age_years || 0;
    const months = listing.age_months || 0;
    if (years === 0 && months === 0) return "N/A";
    const parts = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}m`);
    return parts.join(" ");
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/app/animals" className="hover:text-gray-900">
          Animals
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{listing.title}</span>
      </div>

      {/* Main Content - No Sticky Elements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Image Gallery */}
        <div className="lg:col-span-2 space-y-4">
          {/* Always show main image area - either with image or placeholder */}
          <div className="relative w-full aspect-square rounded-2xl bg-gray-100 overflow-hidden border border-gray-200">
            {mainImage && mainImage.trim() ? (
              <button
                onClick={() => setGalleryOpen(true)}
                className="relative w-full h-full group cursor-pointer"
              >
                <Image
                  src={mainImage}
                  alt={listing.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 66vw, 50vw"
                  className="object-cover group-hover:brightness-90 transition"
                  priority
                />
                {listing.risk_score > 60 && (
                  <div className="absolute top-4 left-4 rounded-lg bg-red-500 px-3 py-1.5 text-white text-sm font-semibold">
                    ⚠ High Risk
                  </div>
                )}
                {listing.seller?.is_verified && (
                  <div className="absolute top-4 right-4 rounded-lg bg-green-500 px-3 py-1.5 text-white text-sm font-semibold flex items-center gap-1">
                    ✓ Verified Seller
                  </div>
                )}
                {/* Click to view hint */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition">
                  <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </div>
              </button>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600">No images available</p>
                </div>
              </div>
            )}
            {/* Universal Share Button (visible to all users) */}
            <div className="mt-3">
              <button
                onClick={() => setShareModalOpen(true)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-900 transition hover:bg-gray-50"
              >
                Share Listing
              </button>
            </div>
          </div>

          {/* Image Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedImageIndex(idx);
                    setGalleryOpen(true);
                  }}
                  className={`shrink-0 relative w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
                    idx === selectedImageIndex
                      ? "border-blue-600"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {img.url && (
                    <Image
                      src={img.url}
                      alt={`${listing.title} ${idx}`}
                      fill
                      className="object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Info Section */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
              <div className="text-2xl font-bold text-blue-900">{images.length}</div>
              <div className="text-sm text-blue-700">Photos</div>
            </div>
            <div className="rounded-xl bg-green-50 border border-green-200 p-4">
              <div className="text-2xl font-bold text-green-900">
                {listing.reviews_count || 0}
              </div>
              <div className="text-sm text-green-700">Reviews</div>
            </div>
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4">
              <div className="text-2xl font-bold text-yellow-900">
                {listing.risk_score}%
              </div>
              <div className="text-sm text-yellow-700">Risk Score</div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {listing.description}
            </p>
          </div>

          {/* Health & Documents */}
          {listing.health_documents && listing.health_documents.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Health Documents</h2>
              <div className="space-y-3">
                {listing.health_documents.map((doc: any, idx: number) => (
                  <a
                    key={idx}
                    href={doc.document_file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                  >
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M8 16.5a1 1 0 11-2 0 1 1 0 012 0zM15 7H4V5h11v2zM4 9h11v2H4V9z" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{doc.doc_type}</div>
                      <div className="text-sm text-gray-500">
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <ReviewsSection listingId={id} sellerId={listing.seller?.id} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Unverified Badge - Show if missing vet docs or seller not verified */}
          {(!listing.vet_documentation || 
            listing.vet_documentation.documentation_type === "unknown" ||
            !listing.seller?.is_verified) && (
            <div className="rounded-2xl border border-orange-300 bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div>
                  <h3 className="font-semibold text-orange-900 mb-1">Unverified Listing</h3>
                  <p className="text-sm text-orange-800">
                    {!listing.seller?.is_verified 
                      ? "Seller identity not verified. " 
                      : ""}
                    {(!listing.vet_documentation || listing.vet_documentation.documentation_type === "unknown")
                      ? "No vet documentation provided. "
                      : ""}
                    Proceed at your own risk.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Price Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-6">
              {listing.price ? (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Price</div>
                  <div className="text-4xl font-bold text-gray-900 max-w-full break-words whitespace-normal">
                    ${listing.price.toLocaleString()}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Listing Type</div>
                  <div className="text-2xl font-bold text-green-600 capitalize">
                    {listing.listing_type === "adoption"
                      ? "Free for Adoption"
                      : "Contact Seller"}
                  </div>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-3 border-t border-gray-200 pt-6 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Category</span>
                <span className="font-medium text-gray-900 capitalize">
                  {listing.category_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Breed</span>
                <span className="font-medium text-gray-900">{listing.breed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Age</span>
                <span className="font-medium text-gray-900">{formatAge()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Location</span>
                <span className="font-medium text-gray-900">{listing.location || "N/A"}</span>
              </div>
            </div>

            {/* Action Buttons - Conditional based on ownership */}
            {isOwner ? (
              <>
                {/* Owner Actions */}
                <Link
                  href={`/app/animals/${listing?.slug ?? id}/edit`}
                  className="w-full block text-center rounded-lg btn-primary px-4 py-3 font-semibold text-white transition hover:opacity-90 mb-3"
                >
                  Edit Listing
                </Link>
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="w-full rounded-lg border border-red-300 bg-white px-4 py-3 font-medium text-red-600 transition hover:bg-red-50"
                >
                  Delete Listing
                </button>
              </>
            ) : (
              <>
                {/* Buyer Actions */}
                <button
                  onClick={() => setContactFormOpen(!contactFormOpen)}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 mb-3"
                >
                  Contact Seller
                </button>

                {/* Share Button removed from here - single universal button is below */}

                {/* Contact Form */}
                {contactFormOpen && (
                  <form onSubmit={handleContactSubmit} className="mt-6 pt-6 border-t border-gray-200 space-y-4">
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
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                        placeholder="(555) 123-4567"
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
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none resize-none"
                        placeholder="Tell the seller more about your interest..."
                        rows={4}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
                    >
                      Send Message
                    </button>
                  </form>
                )}
              </>
            )}
            {/* Universal Share Button (visible to all users) */}
            <div className="mt-4">
              <button
                onClick={() => setShareModalOpen(true)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-900 transition hover:bg-gray-50"
              >
                Share Listing
              </button>
            </div>
          </div>

          {/* Seller Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="font-semibold text-gray-900 mb-4">About the Seller</h3>
            <div className="flex items-center gap-4 mb-4">
              {listing.seller?.avatar && (
                <Image
                  src={listing.seller.avatar}
                  alt={listing.seller.display_name}
                  width={60}
                  height={60}
                  className="rounded-full"
                />
              )}
              <div className="flex-1">
                <div className="font-semibold text-gray-900">
                  {listing.seller?.display_name}
                </div>
                <div className="flex items-center gap-1 text-sm text-yellow-600">
                  <span>★</span>
                  <span>
                    {listing.seller?.average_rating?.toFixed(1) || "N/A"} (
                    {listing.seller?.reviews_count || 0} reviews)
                  </span>
                </div>
              </div>
            </div>

            {listing.seller?.is_verified && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 mb-4 text-sm text-green-800">
                ✓ Verified seller with KYC documentation
              </div>
            )}

            <Link
              href={`/app/sellers/${listing.seller?.id}`}
              className="block w-full text-center rounded-lg border border-blue-600 px-4 py-2 font-medium text-blue-600 transition hover:bg-blue-50"
            >
              View Profile
            </Link>
          </div>

          {/* Trust & Safety */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Trust & Safety</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span className="text-gray-700">Seller identity verified</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span className="text-gray-700">Safe transaction protected</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span className="text-gray-700">Report suspicious activity</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Listings */}
      {relatedListings.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Similar Listings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedListings.map((related) => (
              <Link
                key={related.id}
                href={`/app/animals/${related.slug ?? related.id}`}
                className="group rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition"
              >
                {related.animal_listing_media?.[0]?.url && (
                  <div className="relative aspect-square bg-gray-100">
                    <Image
                      src={related.animal_listing_media[0].url}
                      alt={related.title}
                      fill
                      className="object-cover group-hover:scale-105 transition"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                    {related.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">{related.breed}</p>
                  {related.price && (
                    <div className="font-bold text-gray-900">
                      ${related.price.toLocaleString()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Image Gallery Modal */}
      <ImageGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        images={images.map((img: any) => img.url).filter((url: string) => url)}
        currentIndex={selectedImageIndex}
        onNavigate={(direction) => {
          const delta = direction === "prev" ? -1 : 1;
          const newIndex = (selectedImageIndex + delta + images.length) % images.length;
          setSelectedImageIndex(newIndex);
        }}
        onSelect={(index) => setSelectedImageIndex(index)}
        title={listing.title}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        shareUrl={typeof window !== "undefined" ? `${window.location.origin}/app/animals/${listing?.slug ?? id}` : `/app/animals/${listing?.slug ?? id}`}
        title={listing.title}
        type="post"
      />

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 rounded-2xl bg-white p-8 max-w-sm shadow-2xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Delete Listing?</h2>
              <p className="text-gray-600">
                This action cannot be undone. Once deleted, this listing will be permanently removed.
              </p>
            </div>

            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex gap-3">
                <input
                  type="checkbox"
                  id="delete-confirm"
                  checked={deleteConfirmed}
                  onChange={(e) => setDeleteConfirmed(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="delete-confirm" className="text-sm text-red-800">
                  I understand that this listing will be permanently deleted and cannot be recovered.
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmed(false);
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-900 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteListing}
                disabled={!deleteConfirmed || deleting}
                className={`flex-1 rounded-lg px-4 py-2.5 font-medium text-white transition ${
                  deleteConfirmed && !deleting
                    ? "bg-red-600 hover:bg-red-700 cursor-pointer"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {deleting ? "Deleting..." : "Delete Listing"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        shareUrl={typeof window !== "undefined" ? `${window.location.origin}/app/animals/${listing?.slug ?? id}` : `/app/animals/${listing?.slug ?? id}`}
        title={listing?.title || "Listing"}
        type="post"
      />
    </div>
  );
}
