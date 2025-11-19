"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getListingReviews, createReview } from "@/lib/animals";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";

interface ReviewsSectionProps {
  listingId: string;
}

export default function ReviewsSection({ listingId }: ReviewsSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const { show: showToast } = useToast();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    rating: 5,
    review_text: "",
  });

  useEffect(() => {
    loadReviews();
  }, [listingId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const data = await getListingReviews(listingId);
      setReviews(data);
    } catch (error) {
      console.error("Failed to load reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      showToast("Please sign in to leave a review", "error");
      return;
    }

    try {
      setSubmitting(true);
      // Note: This needs to be adjusted based on the actual API requirements
      // For now, we're creating a basic review - the seller, buyer, and transaction_completed
      // fields should be set based on the actual context
      await createReview({
        listing: listingId,
        seller: "", // Would need to be fetched from listing context
        buyer: user?.id || "",
        rating: formData.rating,
        review_text: formData.review_text,
        transaction_completed: true,
      });
      showToast("Review submitted successfully", "success");
      setFormData({ rating: 5, review_text: "" });
      setShowForm(false);
      await loadReviews();
    } catch (error) {
      showToast("Failed to submit review", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  const ratingCounts = {
    5: reviews.filter((r) => r.rating === 5).length,
    4: reviews.filter((r) => r.rating === 4).length,
    3: reviews.filter((r) => r.rating === 3).length,
    2: reviews.filter((r) => r.rating === 2).length,
    1: reviews.filter((r) => r.rating === 1).length,
  };

  const RatingBar = ({ rating, count }: { rating: number; count: number }) => {
    const percentage = reviews.length ? (count / reviews.length) * 100 : 0;
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 w-8">{rating}★</span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm text-gray-600 w-8 text-right">{count}</span>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Reviews</h2>

      {reviews.length > 0 ? (
        <>
          {/* Rating Summary */}
          <div className="grid grid-cols-2 gap-8 pb-6 border-b border-gray-200 mb-6">
            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-gray-900">
                  {averageRating}
                </span>
                <span className="text-yellow-500">★</span>
              </div>
              <p className="text-sm text-gray-600">Based on {reviews.length} reviews</p>
            </div>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => (
                <RatingBar key={rating} rating={rating} count={ratingCounts[rating as keyof typeof ratingCounts]} />
              ))}
            </div>
          </div>

          {/* Leave Review Button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mb-6 w-full rounded-lg border border-blue-600 px-4 py-2.5 font-medium text-blue-600 transition hover:bg-blue-50"
            >
              Leave a Review
            </button>
          )}

          {/* Review Form */}
          {showForm && (
            <form onSubmit={handleSubmitReview} className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className="text-3xl transition hover:scale-110"
                    >
                      <span
                        className={
                          star <= formData.rating ? "text-yellow-400" : "text-gray-300"
                        }
                      >
                        ★
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Your Review
                </label>
                <textarea
                  value={formData.review_text}
                  onChange={(e) =>
                    setFormData({ ...formData, review_text: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none resize-none"
                  placeholder="Share your experience with this seller and animal..."
                  rows={4}
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {submitting ? "Submitting..." : "Submit Review"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-900 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Reviews List */}
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                <div className="flex gap-4">
                  {review.reviewer?.avatar && (
                    <Image
                      src={review.reviewer.avatar}
                      alt={review.reviewer.display_name}
                      width={40}
                      height={40}
                      className="rounded-full flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {review.reviewer?.display_name || "Anonymous"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-500">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < review.rating ? "" : "opacity-30"}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {review.comment}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">No reviews yet</p>
          {isAuthenticated && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Be the First to Review
            </button>
          )}
        </div>
      )}
    </div>
  );
}
