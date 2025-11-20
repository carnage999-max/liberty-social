"use client";

import { useState } from "react";
import { createAnimalListing, uploadListingMedia } from "@/lib/animals";
import { useToast } from "@/components/Toast";
import { useAnimalCategories } from "@/hooks/useAnimalCategories";
import { useRouter } from "next/navigation";
import Image from "next/image";

// US States mapping for state codes
const US_STATES = {
  "Alabama": "AL",
  "Alaska": "AK",
  "Arizona": "AZ",
  "Arkansas": "AR",
  "California": "CA",
  "Colorado": "CO",
  "Connecticut": "CT",
  "Delaware": "DE",
  "Florida": "FL",
  "Georgia": "GA",
  "Hawaii": "HI",
  "Idaho": "ID",
  "Illinois": "IL",
  "Indiana": "IN",
  "Iowa": "IA",
  "Kansas": "KS",
  "Kentucky": "KY",
  "Louisiana": "LA",
  "Maine": "ME",
  "Maryland": "MD",
  "Massachusetts": "MA",
  "Michigan": "MI",
  "Minnesota": "MN",
  "Mississippi": "MS",
  "Missouri": "MO",
  "Montana": "MT",
  "Nebraska": "NE",
  "Nevada": "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  "Ohio": "OH",
  "Oklahoma": "OK",
  "Oregon": "OR",
  "Pennsylvania": "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  "Tennessee": "TN",
  "Texas": "TX",
  "Utah": "UT",
  "Vermont": "VT",
  "Virginia": "VA",
  "Washington": "WA",
  "West Virginia": "WV",
  "Wisconsin": "WI",
  "Wyoming": "WY",
} as const;

const STATE_CODES = Object.values(US_STATES);

type Step = "basic" | "pricing" | "health" | "media" | "review";

interface FormData {
  title: string;
  breed: string;
  category: string;
  description: string;
  gender: "male" | "female" | "unknown";
  age_value: number;
  age_unit: "days" | "months" | "years";
  color: string;
  listing_type: "sale" | "adoption" | "rehoming";
  price?: number;
  city: string;
  state: string;
  health_documents: File[];
  media_files: File[];
  conditions_accepted: boolean;
}

interface UploadPreview {
  file: File;
  preview: string;
  type: "image" | "document";
}

export default function AnimalListingForm() {
  const router = useRouter();
  const { show: showToast } = useToast();
  const { categories, loading: categoriesLoading } = useAnimalCategories();
  const [currentStep, setCurrentStep] = useState<Step>("basic");
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<UploadPreview[]>([]);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    breed: "",
    category: "",
    description: "",
    gender: "unknown",
    age_value: 1,
    age_unit: "months",
    color: "",
    listing_type: "sale",
    city: "",
    state: "",
    health_documents: [],
    media_files: [],
    conditions_accepted: false,
  });

  const steps: { id: Step; label: string; description: string }[] = [
    { id: "basic", label: "Basic Info", description: "Title, breed, category" },
    { id: "pricing", label: "Pricing", description: "Price & location" },
    { id: "health", label: "Health Docs", description: "Veterinary documents" },
    { id: "media", label: "Photos & Media", description: "Upload images" },
    { id: "review", label: "Review", description: "Confirm details" },
  ];

  const canProceed = () => {
    switch (currentStep) {
      case "basic":
        return formData.title && formData.breed && formData.category && formData.color;
      case "pricing":
        return formData.listing_type && formData.city && formData.state &&
               (formData.listing_type === "sale" ? formData.price : true);
      case "health":
        return true; // Optional step
      case "media":
        return mediaPreview.length > 0;
      case "review":
        return formData.conditions_accepted;
      default:
        return false;
    }
  };

  const goToStep = (step: Step) => {
    const stepIndex = steps.findIndex((s) => s.id === step);
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    if (stepIndex <= currentIndex) {
      setCurrentStep(step);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: "media" | "health") => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFileSelect(files, type);
  };

  const handleFileSelect = (files: File[], type: "media" | "health") => {
    if (type === "media") {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      imageFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setMediaPreview((prev) => [
            ...prev,
            {
              file,
              preview: e.target?.result as string,
              type: "image",
            },
          ]);
        };
        reader.readAsDataURL(file);
      });
      setFormData((prev) => ({
        ...prev,
        media_files: [...prev.media_files, ...imageFiles],
      }));
    } else {
      const docFiles = files.filter(
        (f) =>
          f.type === "application/pdf" ||
          f.type === "image/png" ||
          f.type === "image/jpeg"
      );
      setFormData((prev) => ({
        ...prev,
        health_documents: [...prev.health_documents, ...docFiles],
      }));
    }
  };

  const removeMedia = (index: number) => {
    setMediaPreview((prev) => prev.filter((_, i) => i !== index));
    setFormData((prev) => ({
      ...prev,
      media_files: prev.media_files.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      // Convert age to years/months format expected by backend
      let age_years = 0;
      let age_months = 0;
      if (formData.age_unit === "years") {
        age_years = formData.age_value;
      } else if (formData.age_unit === "months") {
        age_months = formData.age_value;
      } else if (formData.age_unit === "days") {
        // Convert days to months (approximation)
        age_months = Math.floor(formData.age_value / 30);
      }

      // Create listing
      const listingData = {
        title: formData.title,
        breed: formData.breed,
        category: formData.category,
        description: formData.description,
        gender: formData.gender,
        age_years,
        age_months,
        color: formData.color,
        listing_type: formData.listing_type,
        price: formData.listing_type === "sale" ? (formData.price || 0) : 0,
        location: `${formData.city}, ${formData.state}`,
        state_code: formData.state,
      };

      const listing = await createAnimalListing(listingData);

      // Upload media
      if (mediaPreview.length > 0) {
        const formDataMedia = new FormData();
        mediaPreview.forEach((m) => {
          formDataMedia.append("media_files", m.file);
        });
        // Pass listing ID to uploadListingMedia
        await uploadListingMedia(listing.id, formDataMedia);
      }

      showToast("Listing created successfully!", "success");

      router.push(`/app/animals/${listing.id}`);
    } catch (error: any) {
      console.error("Listing creation error:", error);
      const errorMsg = error?.message || "Failed to create listing";
      showToast(errorMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Listing</h1>
        <p className="text-gray-600">List your animal safely and securely</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => goToStep(step.id)}
                disabled={!steps.slice(0, idx).every((s) => {
                  if (s.id === "basic")
                    return formData.title && formData.breed && formData.category;
                  if (s.id === "pricing")
                    return formData.listing_type && formData.city && formData.state;
                  return true;
                })}
                className={`relative flex h-10 w-10 items-center justify-center rounded-full font-semibold transition ${
                  currentStep === step.id
                    ? "bg-blue-600 text-white"
                    : steps.findIndex((s) => s.id === currentStep) > idx
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {steps.findIndex((s) => s.id === currentStep) > idx ? "✓" : idx + 1}
              </button>
              {idx < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 ${
                    steps.findIndex((s) => s.id === currentStep) > idx
                      ? "bg-green-600"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="grid grid-cols-5 gap-2">
          {steps.map((step) => (
            <div key={step.id} className="text-center">
              <p
                className={`text-xs font-medium ${
                  currentStep === step.id ? "text-blue-600" : "text-gray-600"
                }`}
              >
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="rounded-2xl border border-gray-200 bg-white p-8">
        {/* Step 1: Basic Information */}
        {currentStep === "basic" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Listing Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Beautiful Golden Retriever Puppies"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Breed *
                </label>
                <input
                  type="text"
                  value={formData.breed}
                  onChange={(e) =>
                    setFormData({ ...formData, breed: e.target.value })
                  }
                  placeholder="e.g., Golden Retriever"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Age
              </label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={formData.age_value}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      age_value: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                  className="w-24 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                  placeholder="0"
                />
                <select
                  value={formData.age_unit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      age_unit: e.target.value as any,
                    })
                  }
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Gender *
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gender: e.target.value as any,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="unknown">Unknown</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Color *
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  placeholder="e.g., Golden, Black, Brown"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe the animal, temperament, health status, etc."
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 2: Pricing & Location */}
        {currentStep === "pricing" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Listing Type *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "sale", label: "For Sale", icon: "💰" },
                  { value: "adoption", label: "For Adoption", icon: "🏠" },
                  { value: "rehoming", label: "Rehoming", icon: "🤝" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        listing_type: option.value as any,
                      })
                    }
                    className={`rounded-lg border-2 p-4 text-center transition ${
                      formData.listing_type === option.value
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="text-2xl mb-2">{option.icon}</div>
                    <p className="font-medium text-gray-900">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {formData.listing_type === "sale" && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Price (USD) *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium">$</span>
                  <input
                    type="number"
                    value={formData.price || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    min="0"
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="e.g., New York"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-900 mb-2">
                  State *
                </label>
                <select
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select a state</option>
                  {Object.entries(US_STATES).map(([stateName, code]) => (
                    <option key={code} value={code}>
                      {stateName} ({code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Health Documents */}
        {currentStep === "health" && (
          <div className="space-y-6">
            <p className="text-gray-600">
              Upload veterinary documents, vaccination records, and health certifications
              (Optional but recommended for higher trust)
            </p>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e, "health")}
              className={`rounded-lg border-2 border-dashed p-8 text-center transition ${
                dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
              }`}
            >
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M24 4v40m-16-8l8-8m-8 8l-8-8M4 24h40M28 8l-8 8m8-8l8 8"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-gray-900 font-medium mb-1">Drag documents here</p>
              <p className="text-sm text-gray-600 mb-4">
                or{" "}
                <label className="text-blue-600 font-medium cursor-pointer hover:underline">
                  click to browse
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) =>
                      handleFileSelect(
                        Array.from(e.target.files || []),
                        "health"
                      )
                    }
                    className="hidden"
                  />
                </label>
              </p>
              <p className="text-xs text-gray-500">
                Supported: PDF, PNG, JPG (up to 10MB each)
              </p>
            </div>

            {formData.health_documents.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-gray-900">
                  Uploaded documents ({formData.health_documents.length})
                </p>
                <ul className="space-y-2">
                  {formData.health_documents.map((file, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                    >
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            health_documents: prev.health_documents.filter(
                              (_, i) => i !== idx
                            ),
                          }));
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Media Upload */}
        {currentStep === "media" && (
          <div className="space-y-6">
            <p className="text-gray-600">
              Upload at least 1 high-quality photo. Listings with more photos get more views!
            </p>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e, "media")}
              className={`rounded-lg border-2 border-dashed p-8 text-center transition ${
                dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
              }`}
            >
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M8 14v24c0 2.2 1.8 4 4 4h24c2.2 0 4-1.8 4-4V14M16 26l8-8 8 8m-16-16h24c2.2 0 4 1.8 4 4v24"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-gray-900 font-medium mb-1">Drag photos here</p>
              <p className="text-sm text-gray-600 mb-4">
                or{" "}
                <label className="text-blue-600 font-medium cursor-pointer hover:underline">
                  click to browse
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) =>
                      handleFileSelect(Array.from(e.target.files || []), "media")
                    }
                    className="hidden"
                  />
                </label>
              </p>
              <p className="text-xs text-gray-500">
                Supported: JPG, PNG (up to 10MB each)
              </p>
            </div>

            {mediaPreview.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-gray-900">
                  Preview ({mediaPreview.length})
                </p>
                <div className="grid grid-cols-4 gap-4">
                  {mediaPreview.map((preview, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-lg overflow-hidden border border-gray-200"
                    >
                      <Image
                        src={preview.preview}
                        alt={`Preview ${idx}`}
                        fill
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeMedia(idx)}
                        className="absolute top-2 right-2 rounded-full bg-red-600 text-white p-1 hover:bg-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === "review" && (
          <div className="space-y-6">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Listing Summary</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p>
                  <span className="font-medium">Title:</span> {formData.title}
                </p>
                <p>
                  <span className="font-medium">Breed:</span> {formData.breed}
                </p>
                <p>
                  <span className="font-medium">Type:</span>{" "}
                  {formData.listing_type.toUpperCase()}
                </p>
                {formData.listing_type === "sale" && (
                  <p>
                    <span className="font-medium">Price:</span> ${formData.price}
                  </p>
                )}
                <p>
                  <span className="font-medium">Location:</span> {formData.city},{" "}
                  {formData.state}
                </p>
                <p>
                  <span className="font-medium">Photos:</span>{" "}
                  {mediaPreview.length}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.conditions_accepted}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      conditions_accepted: e.target.checked,
                    })
                  }
                  className="mt-1"
                />
                <span className="text-sm text-gray-700">
                  I confirm that all information is accurate and truthful. I understand
                  that false information may result in account suspension.
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-8 flex gap-4 justify-between">
        <button
          onClick={() => {
            const currentIndex = steps.findIndex((s) => s.id === currentStep);
            if (currentIndex > 0) {
              setCurrentStep(steps[currentIndex - 1].id);
            }
          }}
          disabled={currentStep === "basic"}
          className="rounded-lg border border-gray-300 px-6 py-2.5 font-medium text-gray-900 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>

        {currentStep !== "review" ? (
          <button
            onClick={() => {
              const currentIndex = steps.findIndex((s) => s.id === currentStep);
              setCurrentStep(steps[currentIndex + 1].id);
            }}
            disabled={!canProceed()}
            className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed() || submitting}
            className="rounded-lg bg-green-600 px-6 py-2.5 font-medium text-white transition hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating..." : "Create Listing"}
          </button>
        )}
      </div>
    </div>
  );
}
