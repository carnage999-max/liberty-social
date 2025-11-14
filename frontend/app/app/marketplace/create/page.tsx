"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MediaUploadField, { UploadedMedia } from "@/components/marketplace/MediaUploadField";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { MarketplaceCategory, ListingCondition } from "@/lib/types";
import { apiPost, apiGet } from "@/lib/api";

export default function CreateListingPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [media, setMedia] = useState<UploadedMedia[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "used" as ListingCondition,
    location: "",
    contact_preference: "both" as "chat" | "call" | "both",
    delivery_options: "both" as "pickup" | "delivery" | "both",
  });

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await apiGet("/marketplace/categories/");
        setCategories(response.results || response);
      } catch (error) {
        console.error("Failed to load categories:", error);
        toast.show("Failed to load categories", "error");
      }
    };
    loadCategories();
  }, [toast]);

  // Check authentication
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to create a listing</p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDeliveryChange = (option: "pickup" | "delivery") => {
    setFormData((prev) => {
      const current = prev.delivery_options;
      
      // Toggle: if both is selected, unselect this option
      // If only one option is selected, selecting the other makes it "both"
      // If only one is selected, clicking the same one keeps it
      if (current === "both") {
        return { ...prev, delivery_options: option };
      } else if (current === option) {
        // Keep current state
        return prev;
      } else {
        // Current is the other option, so make it "both"
        return { ...prev, delivery_options: "both" };
      }
    });
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.show("Please enter a title", "error");
      return false;
    }
    if (!formData.description.trim()) {
      toast.show("Please enter a description", "error");
      return false;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.show("Please enter a valid price", "error");
      return false;
    }
    if (!formData.category) {
      toast.show("Please select a category", "error");
      return false;
    }
    if (!formData.location.trim()) {
      toast.show("Please enter a location", "error");
      return false;
    }
    if (media.length === 0) {
      toast.show("Please upload at least one image", "error");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Create listing
      const listingData = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        category_id: parseInt(formData.category),
        condition: formData.condition,
        location: formData.location,
        contact_preference: formData.contact_preference,
        delivery_options: formData.delivery_options,
        status: "active",
      };

      const listing = await apiPost("/marketplace/listings/", listingData, {
        token: accessToken,
      });

      // Upload media if there are URLs (they should already be uploaded)
      if (media.length > 0) {
        // Media URLs are already from the upload endpoint
        // Now we need to create MediaItems for each image
        for (const item of media) {
          try {
            await apiPost(
              "/marketplace/media/",
              {
                listing: listing.id,
                media_url: item.url,
                media_type: "image",
                order: item.order,
              },
              { token: accessToken }
            );
          } catch (error) {
            console.error("Failed to link media:", error);
            // Continue with other media
          }
        }
      }

      toast.show("Listing created successfully!", "success");
      router.push(`/app/marketplace/${listing.id}`);
    } catch (error: any) {
      console.error("Failed to create listing:", error);
      console.error("Error details:", {
        message: error?.message,
        data: error?.data,
        fieldErrors: error?.fieldErrors,
        nonFieldErrors: error?.nonFieldErrors,
      });
      const message = error?.data?.detail || error?.message || "Failed to create listing";
      toast.show(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/app/marketplace"
            className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Marketplace
          </Link>
          <h1 className="text-3xl font-bold text-black">Create New Listing</h1>
          <p className="text-gray-600 mt-2">
            Share your item with the Liberty Social community
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-black mb-1.5">
              Item Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Vintage Leather Jacket"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-black mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your item in detail, condition, brand, size, etc."
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none text-black"
              disabled={loading}
            />
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-black mb-1.5">
                Price ($)
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
                disabled={loading}
              />
            </div>

            {/* Condition */}
            <div>
              <label className="block text-sm font-semibold text-black mb-1.5">
                Condition
              </label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
                disabled={loading}
              >
                <option value="new">New</option>
                <option value="like_new">Like New</option>
                <option value="used">Used</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>

          {/* Category & Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-black mb-1.5">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
                disabled={loading}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-black mb-1.5">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="City, State"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
                disabled={loading}
              />
            </div>
          </div>

          {/* Contact Preference */}
          <div>
            <label className="block text-sm font-semibold text-black mb-1.5">
              Preferred Contact Method
            </label>
            <select
              name="contact_preference"
              value={formData.contact_preference}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
              disabled={loading}
            >
              <option value="chat">Chat</option>
              <option value="call">Call</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* Delivery Options */}
          <div>
            <label className="block text-sm font-semibold text-black mb-3">
              Delivery Options
            </label>
            <div className="space-y-2">
              {[
                { id: "pickup", label: "Local Pickup" },
                { id: "delivery", label: "Delivery Available" },
              ].map(({ id, label }) => (
                <label
                  key={id}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={
                      formData.delivery_options === "both" ||
                      formData.delivery_options === (id as "pickup" | "delivery")
                    }
                    onChange={() =>
                      handleDeliveryChange(id as "pickup" | "delivery")
                    }
                    disabled={loading}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Media Upload */}
          <MediaUploadField
            label="Upload Images"
            value={media}
            onChange={setMedia}
            disabled={loading}
            maxFiles={5}
          />

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </>
              ) : (
                "Create Listing"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
