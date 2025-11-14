"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import MediaUploadField, { UploadedMedia } from "@/components/marketplace/MediaUploadField";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { MarketplaceCategory, ListingCondition, MarketplaceListing } from "@/lib/types";
import { apiPost, apiGet, apiPatch, apiDelete } from "@/lib/api";

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { user, accessToken } = useAuth();
  const listingId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<number[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "used" as ListingCondition,
    location: "",
    contact_preference: "chat" as "chat" | "call" | "both",
    delivery_options: ["pickup"] as Array<"pickup" | "delivery">,
  });

  // Load listing and categories on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [listingRes, categoriesRes] = await Promise.all([
          apiGet(`/marketplace/listings/${listingId}/`, { token: accessToken }),
          apiGet("/marketplace/categories/", { token: accessToken }),
        ]);

        setListing(listingRes);
        setCategories(categoriesRes.results || categoriesRes);

        // Populate form with listing data
        const deliveryOptions: Array<"pickup" | "delivery"> = [];
        if (typeof listingRes.delivery_options === "string") {
          if (listingRes.delivery_options === "both") {
            deliveryOptions.push("pickup", "delivery");
          } else if (listingRes.delivery_options === "pickup") {
            deliveryOptions.push("pickup");
          } else if (listingRes.delivery_options === "delivery") {
            deliveryOptions.push("delivery");
          }
        } else if (Array.isArray(listingRes.delivery_options)) {
          deliveryOptions.push(...(listingRes.delivery_options as any));
        }

        setFormData({
          title: listingRes.title,
          description: listingRes.description,
          price: listingRes.price.toString(),
          category: listingRes.category.id,
          condition: listingRes.condition,
          location: listingRes.location,
          contact_preference: listingRes.contact_preference,
          delivery_options: deliveryOptions,
        });

        // Load existing media
        if (listingRes.media && listingRes.media.length > 0) {
          setMedia(
            listingRes.media.map((m: any) => ({
              url: m.url,
              order: m.order,
              id: m.id,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to load listing:", error);
        toast.show("Failed to load listing", "error");
        router.push("/app/marketplace");
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();
  }, [listingId, toast, router, accessToken]);

  // Check ownership
  if (!initialLoading && listing && listing.seller.id !== user?.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">You don't have permission to edit this listing</p>
          <Link
            href="/app/marketplace"
            className="inline-block px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading listing...</p>
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
      const updated = prev.delivery_options.includes(option)
        ? prev.delivery_options.filter((o) => o !== option)
        : [...prev.delivery_options, option];
      return { ...prev, delivery_options: updated as Array<"pickup" | "delivery"> };
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
      toast.show("Please keep at least one image", "error");
      return false;
    }
    if (formData.delivery_options.length === 0) {
      toast.show("Please select at least one delivery option", "error");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Update listing
      const updateData = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        category_id: parseInt(formData.category),
        condition: formData.condition,
        location: formData.location,
        contact_preference: formData.contact_preference,
        delivery_options: formData.delivery_options.includes("pickup") && formData.delivery_options.includes("delivery") 
          ? "both" 
          : formData.delivery_options[0] || "pickup",
      };

      await apiPatch(`/marketplace/listings/${listingId}/`, updateData, { token: accessToken });

      // Handle removed media
      for (const mediaId of removedMediaIds) {
        try {
          await apiDelete(`/marketplace/media/${mediaId}/`, { token: accessToken });
        } catch (error) {
          console.error(`Failed to delete media ${mediaId}:`, error);
        }
      }

      // Add new media (those without id property)
      const newMedia = media.filter((m) => !("id" in m) || !m.id);
      for (const item of newMedia) {
        try {
          await apiPost("/marketplace/media/", {
            listing_id: listingId,
            url: item.url,
            content_type: "image/jpeg",
            order: item.order,
          }, { token: accessToken });
        } catch (error) {
          console.error("Failed to add media:", error);
        }
      }

      toast.show("Listing updated successfully!", "success");
      router.push(`/app/marketplace/${listingId}`);
    } catch (error: any) {
      console.error("Failed to update listing:", error);
      const message = error?.data?.detail || error?.message || "Failed to update listing";
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
            href={`/app/marketplace/${listingId}`}
            className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Listing
          </Link>
          <h1 className="text-3xl font-bold text-black">Edit Listing</h1>
          <p className="text-gray-600 mt-2">
            Update your listing information
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
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    checked={formData.delivery_options.includes(
                      id as "pickup" | "delivery"
                    )}
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
                  Updating...
                </>
              ) : (
                "Update Listing"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
