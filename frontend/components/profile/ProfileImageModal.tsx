"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { useToast } from "@/components/Toast";
import { API_BASE, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import ImageGallery from "@/components/ImageGallery";

export default function ProfileImageModal({
  open,
  onClose,
  currentImageUrl,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  currentImageUrl?: string | null;
  userId?: string | number | null;
}) {
  const { accessToken, refreshUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [updating, setUpdating] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const handleSelect = () => {
    if (!accessToken) {
      toast.show("You need to be signed in to update your photo.", "error");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setUpdating(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/auth/profile/upload-picture/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Failed to upload profile image.");
      }
      await refreshUser();
      toast.show("Profile photo updated.");
      onClose();
    } catch (err: any) {
      toast.show(err?.message || "Unable to update photo.", "error");
    } finally {
      setUpdating(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!accessToken || !userId) return;
    setUpdating(true);
    try {
      await apiPatch(`/auth/user/${userId}/`, { profile_image_url: null }, { token: accessToken, cache: "no-store" });
      await refreshUser();
      toast.show("Profile photo removed.");
      onClose();
    } catch (err: any) {
      toast.show(err?.message || "Unable to remove photo.", "error");
    } finally {
      setUpdating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-metallic backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Profile photo</h3>
            <p className="text-sm text-gray-500">Update or remove your profile image.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:text-gray-700"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-4">
          {currentImageUrl ? (
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="group relative overflow-hidden rounded-full border-4 border-(--color-deep-navy)/30 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            >
              <Image
                src={currentImageUrl}
                alt="Profile image"
                width={160}
                height={160}
                className="rounded-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20 rounded-full">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </button>
          ) : (
            <Image
              src="/images/default-avatar.png"
              alt="Profile image"
              width={160}
              height={160}
              className="rounded-full object-cover border-4 border-(--color-deep-navy)/30"
            />
          )}

          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={handleSelect}
              disabled={updating}
              className="btn-primary inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-metallic transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updating ? "Updating..." : "Update profile image"}
            </button>
            {currentImageUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={updating}
                className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>
      
      {currentImageUrl && (
        <ImageGallery
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          images={[currentImageUrl]}
          currentIndex={0}
          title="Profile photo"
        />
      )}
    </div>
  );
}
