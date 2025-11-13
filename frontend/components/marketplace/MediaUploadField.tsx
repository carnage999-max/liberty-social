"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { API_BASE } from "@/lib/api";
import Image from "next/image";

export interface UploadedMedia {
  url: string;
  order: number;
  tempId?: string;
  id?: number;
}

interface MediaUploadFieldProps {
  label: string;
  value: UploadedMedia[];
  onChange: (media: UploadedMedia[]) => void;
  disabled?: boolean;
  maxFiles?: number;
}

export default function MediaUploadField({
  label,
  value,
  onChange,
  disabled = false,
  maxFiles = 5,
}: MediaUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check max files
    if (value.length + files.length > maxFiles) {
      toast.show(`Maximum ${maxFiles} images allowed`, "error");
      return;
    }

    setUploading(true);
    const uploadedMedia: UploadedMedia[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast.show(`${file.name} is not an image`, "error");
          continue;
        }

        // Validate file size (5MB max per file)
        if (file.size > 5 * 1024 * 1024) {
          toast.show(`${file.name} is larger than 5MB`, "error");
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const uploadUrl = `${API_BASE}/uploads/images/`;
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Upload error response:", errorData);
          throw new Error(`Upload failed for ${file.name}`);
        }

        const data = await response.json();
        uploadedMedia.push({
          url: data.url,
          order: value.length + uploadedMedia.length,
          tempId: Math.random().toString(36).substr(2, 9),
        });
      }

      if (uploadedMedia.length > 0) {
        onChange([...value, ...uploadedMedia]);
        toast.show(`${uploadedMedia.length} image${uploadedMedia.length > 1 ? "s" : ""} uploaded`, "success");
      }
    } catch (error) {
      console.error(error);
      toast.show("Failed to upload images", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveMedia = (index: number) => {
    onChange(value.filter((_, i) => i !== index).map((m, i) => ({ ...m, order: i })));
  };

  const handleReorderMedia = (fromIndex: number, toIndex: number) => {
    const newMedia = [...value];
    const [removed] = newMedia.splice(fromIndex, 1);
    newMedia.splice(toIndex, 0, removed);
    onChange(newMedia.map((m, i) => ({ ...m, order: i })));
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-black">{label}</label>
      <div className="space-y-3">
        {/* Upload Area */}
        {value.length < maxFiles && (
          <div className="relative rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading || disabled}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <div className="pointer-events-none flex flex-col items-center justify-center text-center">
              <svg
                className="h-8 w-8 text-gray-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm font-medium text-gray-700">
                {uploading ? "Uploading..." : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, GIF up to 5MB ({value.length}/{maxFiles})
              </p>
            </div>
          </div>
        )}

        {/* Media Grid */}
        {value.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">
              {value.length} image{value.length > 1 ? "s" : ""} uploaded
            </div>
            <div className="grid grid-cols-4 gap-2">
              {value.map((media, index) => (
                <div
                  key={media.tempId || media.url}
                  className="relative group h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
                >
                  <Image
                    src={media.url}
                    alt={`Upload ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  {/* Primary Badge */}
                  {index === 0 && (
                    <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                      Primary
                    </div>
                  )}
                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(index)}
                    disabled={disabled}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center disabled:opacity-50"
                  >
                    <svg
                      className="h-5 w-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
