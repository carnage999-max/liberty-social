"use client";

import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";
import type { MarketplaceListing, MarketplaceOffer } from "@/lib/types";
import Spinner from "@/components/Spinner";
import Gallery from "@/components/Gallery";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const listingId = parseInt(params?.id);

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState<number>(0);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [offerForm, setOfferForm] = useState({ offered_price: "", message: "" });
  const [reportForm, setReportForm] = useState({ reason: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken || !listingId) return;
    loadListing();
  }, [accessToken, listingId]);

  const loadListing = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiGet<MarketplaceListing>(`/marketplace/listings/${listingId}/`, {
        token: accessToken,
      });
      setListing(data);
      setIsSaved(data.is_saved || false);
    } catch (error) {
      console.error(error);
      toast.show("Listing not found", "error");
      notFound();
    } finally {
      setLoading(false);
    }
  }, [accessToken, listingId, toast]);

  const handleSave = useCallback(async () => {
    if (!accessToken || !listing) return;
    try {
      await apiPost(`/marketplace/listings/${listing.id}/save/`, {}, { token: accessToken });
      setIsSaved(!isSaved);
      toast.show(isSaved ? "Listing unsaved" : "Listing saved", "success");
    } catch (error) {
      console.error(error);
      toast.show("Failed to save listing", "error");
    }
  }, [accessToken, listing, isSaved, toast]);

  const handleMakeOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !listing) return;
    setSubmitting(true);
    try {
      await apiPost(
        `/marketplace/offers/`,
        {
          listing: listing.id,
          offered_price: offerForm.offered_price,
          message: offerForm.message,
        },
        { token: accessToken }
      );
      toast.show("Offer sent successfully!", "success");
      setShowOfferModal(false);
      setOfferForm({ offered_price: "", message: "" });
    } catch (error) {
      console.error(error);
      toast.show("Failed to make offer", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !listing) return;
    setSubmitting(true);
    try {
      await apiPost(
        `/marketplace/listings/${listing.id}/report/`,
        {
          reason: reportForm.reason,
          description: reportForm.description,
        },
        { token: accessToken }
      );
      toast.show("Report submitted successfully", "success");
      setShowReportModal(false);
      setReportForm({ reason: "", description: "" });
    } catch (error) {
      console.error(error);
      toast.show("Failed to submit report", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isOwner = user?.id === listing?.seller.id;

  if (!listingId) {
    notFound();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!listing) {
    notFound();
  }

  const conditionLabels: Record<string, string> = {
    new: "New",
    like_new: "Like New",
    used: "Used",
    fair: "Fair",
    poor: "Poor",
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/app/marketplace"
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Marketplace
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Images */}
        <div className="lg:col-span-2 space-y-4">
          {/* Main Image */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-100 h-96">
            {listing.media && listing.media.length > 0 ? (
              <button
                onClick={() => setGalleryOpen(0)}
                className="h-full w-full cursor-pointer transition hover:brightness-90"
              >
                <Image
                  src={listing.media[0].url}
                  alt={listing.title}
                  fill
                  className="object-cover"
                />
              </button>
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <svg className="h-20 w-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Thumbnail Gallery */}
          {listing.media && listing.media.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {listing.media.map((media, idx) => (
                <button
                  key={media.id}
                  onClick={() => setGalleryOpen(idx)}
                  className={`rounded-lg overflow-hidden h-20 border-2 transition ${
                    galleryOpen === idx
                      ? "border-(--color-deep-navy)"
                      : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <Image
                    src={media.url}
                    alt={`${listing.title} ${idx + 1}`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details Sidebar */}
        <div className="space-y-4">
          {/* Status Badge */}
          {listing.status !== "active" && (
            <div className={`rounded-lg px-4 py-2 text-sm font-medium ${
              listing.status === "sold"
                ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-800"
            }`}>
              {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
            </div>
          )}

          {/* Title & Price */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">{listing.title}</h1>
            <div className="text-3xl font-bold text-(--color-deep-navy)">
              ${parseFloat(listing.price).toFixed(2)}
            </div>
          </div>

          {/* Details */}
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Condition:</span>
              <span className="text-sm font-medium text-gray-900">
                {conditionLabels[listing.condition]}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-3">
              <span className="text-sm text-gray-600">Location:</span>
              <span className="text-sm font-medium text-gray-900">{listing.location}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-3">
              <span className="text-sm text-gray-600">Views:</span>
              <span className="text-sm font-medium text-gray-900">{listing.views_count}</span>
            </div>
            {listing.delivery_options && (
              <>
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="text-sm text-gray-600">Delivery:</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {listing.delivery_options}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Seller Info */}
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4">
            <div className="flex items-center gap-3 mb-4">
              {listing.seller.profile_image_url ? (
                <Image
                  src={listing.seller.profile_image_url}
                  alt={listing.seller.username || listing.seller.first_name}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center text-lg font-semibold text-gray-700">
                  {(listing.seller.username || listing.seller.first_name || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                  {listing.seller.username ||
                    `${listing.seller.first_name} ${listing.seller.last_name}`.trim()}
                </h3>
                {listing.is_verified && (
                  <p className="text-xs text-blue-600 font-medium">✓ Verified seller</p>
                )}
              </div>
            </div>
            <Link
              href={`/app/users/${listing.seller.id}`}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 text-center transition hover:bg-gray-100"
            >
              View Profile
            </Link>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {!isOwner && listing.status === "active" && (
              <>
                <button
                  onClick={() => setShowOfferModal(true)}
                  className="w-full rounded-lg bg-(--color-deep-navy) px-4 py-3 text-sm font-semibold text-white transition hover:bg-(--color-deeper-navy)"
                >
                  Make an Offer
                </button>
                <button
                  onClick={handleSave}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isSaved
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {isSaved ? "✓ Saved" : "Save Listing"}
                </button>
              </>
            )}
            {isOwner && (
              <>
                <Link
                  href={`/app/marketplace/${listing.id}/edit`}
                  className="block rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 text-center transition hover:bg-gray-100"
                >
                  Edit Listing
                </Link>
              </>
            )}
            <button
              onClick={() => setShowReportModal(true)}
              className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Report Listing
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-2xl border border-gray-200 bg-white/90 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">About this item</h2>
        <p className="text-gray-700 whitespace-pre-wrap">{listing.description}</p>
      </div>

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Make an Offer</h2>
              <p className="text-sm text-gray-600 mt-1">Current price: ${parseFloat(listing.price).toFixed(2)}</p>
            </div>
            <form onSubmit={handleMakeOffer} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-900">Your Offer</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={offerForm.offered_price}
                  onChange={(e) =>
                    setOfferForm((prev) => ({ ...prev, offered_price: e.target.value }))
                  }
                  disabled={submitting}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700 disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-900">Message (optional)</label>
                <textarea
                  placeholder="Tell the seller about your offer..."
                  rows={3}
                  value={offerForm.message}
                  onChange={(e) =>
                    setOfferForm((prev) => ({ ...prev, message: e.target.value }))
                  }
                  disabled={submitting}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700 disabled:opacity-50"
                />
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOfferModal(false)}
                  disabled={submitting}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-(--color-deep-navy) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--color-deeper-navy) disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Send Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Report Listing</h2>
              <p className="text-sm text-gray-600 mt-1">Help us keep the marketplace safe</p>
            </div>
            <form onSubmit={handleReport} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-900">Reason</label>
                <select
                  required
                  value={reportForm.reason}
                  onChange={(e) =>
                    setReportForm((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  disabled={submitting}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700 disabled:opacity-50"
                >
                  <option value="">Select a reason...</option>
                  <option value="inappropriate">Inappropriate Content</option>
                  <option value="scam">Scam or Fraud</option>
                  <option value="fake_item">Fake or Counterfeit Item</option>
                  <option value="offensive">Offensive or Hateful</option>
                  <option value="spam">Spam</option>
                  <option value="stolen">Stolen Item</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-900">Description</label>
                <textarea
                  placeholder="Describe the issue in detail..."
                  rows={3}
                  required
                  value={reportForm.description}
                  onChange={(e) =>
                    setReportForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  disabled={submitting}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700 disabled:opacity-50"
                />
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  disabled={submitting}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gallery Modal */}
      <Gallery
        isOpen={galleryOpen !== null && listing.media ? true : false}
        onClose={() => setGalleryOpen(0)}
        images={listing.media?.map((m) => m.url) || []}
        initialIndex={galleryOpen}
      />
    </div>
  );
}
