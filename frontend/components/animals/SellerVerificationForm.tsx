"use client";

import { useSellerVerification } from "@/hooks/useSellerVerification";
import { useState } from "react";
import * as animalService from "@/lib/animals";
import { useToast } from "@/components/Toast";

export default function SellerVerificationForm() {
  const { submitVerification, loading } = useSellerVerification();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    phone_number: "",
    identity_document_url: "",
    address_proof_url: "",
    business_name: "",
    years_of_experience: "",
  });
  const [uploading, setUploading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "identity_document_url" | "address_proof_url"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formDataToSubmit = new FormData();
      formDataToSubmit.append("file", file);

      const response = await fetch("/api/uploads/", {
        method: "POST",
        body: formDataToSubmit,
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setFormData((prev) => ({ ...prev, [field]: data.url }));
      toast.show("File uploaded successfully", "success");
    } catch (error) {
      toast.show("Failed to upload file", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submitVerification({
        phone_number: formData.phone_number,
        identity_document_url: formData.identity_document_url,
        address_proof_url: formData.address_proof_url,
        business_name: formData.business_name,
        years_of_experience: parseInt(formData.years_of_experience) || 0,
      });
      toast.show("Verification submitted successfully!", "success");
      setStep(1);
    } catch (error: any) {
      toast.show(error.message || "Failed to submit verification", "error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm transition ${
                  step >= s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-1 w-12 transition ${
                    step > s ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="text-sm text-gray-600 text-center">
          Step {step} of 3
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm space-y-6">
        {/* Step 1: Personal Information */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleInputChange}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-2">
                Years of Experience
              </label>
              <select
                id="experience"
                name="years_of_experience"
                value={formData.years_of_experience}
                onChange={handleInputChange}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                {[1, 2, 3, 5, 10, 15, 20].map((year) => (
                  <option key={year} value={year}>
                    {year} year{year > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-2">
                Business Name (Optional)
              </label>
              <input
                id="business_name"
                type="text"
                name="business_name"
                value={formData.business_name}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., ABC Animal Breeding"
              />
            </div>
          </div>
        )}

        {/* Step 2: Documentation */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Documentation</h2>

            <div>
              <label htmlFor="identity" className="block text-sm font-medium text-gray-700 mb-2">
                Identity Document
              </label>
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-blue-500 transition cursor-pointer">
                <input
                  id="identity"
                  type="file"
                  onChange={(e) => handleFileUpload(e, "identity_document_url")}
                  disabled={uploading}
                  className="hidden"
                  accept="image/*,application/pdf"
                />
                <label htmlFor="identity" className="cursor-pointer block">
                  <svg
                    className="h-12 w-12 mx-auto mb-2 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <p className="text-sm font-medium text-gray-700">
                    {uploading ? "Uploading..." : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-gray-600">PNG, JPG, PDF up to 10MB</p>
                </label>
              </div>
              {formData.identity_document_url && (
                <p className="text-sm text-green-600 mt-2">✓ Document uploaded</p>
              )}
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Address Proof
              </label>
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-blue-500 transition cursor-pointer">
                <input
                  id="address"
                  type="file"
                  onChange={(e) => handleFileUpload(e, "address_proof_url")}
                  disabled={uploading}
                  className="hidden"
                  accept="image/*,application/pdf"
                />
                <label htmlFor="address" className="cursor-pointer block">
                  <svg
                    className="h-12 w-12 mx-auto mb-2 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <p className="text-sm font-medium text-gray-700">
                    {uploading ? "Uploading..." : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-gray-600">PNG, JPG, PDF up to 10MB</p>
                </label>
              </div>
              {formData.address_proof_url && (
                <p className="text-sm text-green-600 mt-2">✓ Document uploaded</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Review Your Information</h2>

            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Phone Number:</span>
                <span className="text-sm text-gray-900">{formData.phone_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Experience:</span>
                <span className="text-sm text-gray-900">{formData.years_of_experience} years</span>
              </div>
              {formData.business_name && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">Business:</span>
                  <span className="text-sm text-gray-900">{formData.business_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Documents:</span>
                <span className="text-sm text-gray-900">
                  {formData.identity_document_url && formData.address_proof_url ? "✓ All uploaded" : "Incomplete"}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm text-blue-900">
                By submitting, you certify that all information is accurate and you agree to our verification policy.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 pt-6 border-t border-gray-200">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-900 transition hover:bg-gray-50"
            >
              Back
            </button>
          )}
          {step < 3 && (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex-1 btn-primary px-4 py-2 font-medium text-white transition hover:opacity-90 rounded-lg"
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button
              type="submit"
              disabled={loading || !formData.identity_document_url || !formData.address_proof_url}
              className="flex-1 btn-primary px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              {loading ? "Submitting..." : "Submit Verification"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
