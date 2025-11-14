"use client";

import { useState } from "react";
import { useToast } from "./Toast";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface ImageUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (url: string) => void;
  onPreview?: (url: string) => void;
  disabled?: boolean;
}

export default function ImageUploadField({
  label,
  value,
  onChange,
  onPreview,
  disabled = false,
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const { accessToken } = useAuth();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.show("Please select an image file", "error");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.show("Image must be less than 5MB", "error");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadUrl = `${API_BASE}/uploads/images/`;
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken || ""}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Upload error response:", errorData);
        throw new Error("Upload failed");
      }

      const data = await response.json();
      console.log("Upload response data:", data);
      const imageUrl = data.url;
      console.log("Extracted image URL:", imageUrl);
      onChange(imageUrl);
      if (onPreview) {
        onPreview(imageUrl);
      }
      toast.show("Image uploaded successfully", "success");
    } catch (error) {
      console.error(error);
      toast.show("Failed to upload image", "error");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-black">{label}</label>
      <div className="space-y-2">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <div className="relative rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={uploading || disabled}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className="pointer-events-none flex items-center gap-2 text-sm text-gray-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {uploading ? "Uploading..." : "Click to upload image"}
              </div>
            </div>
          </div>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
              }}
              disabled={uploading || disabled}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>

        {value && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">Preview:</p>
            <div className="h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Preview" className="h-full w-full object-cover" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
