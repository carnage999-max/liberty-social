"use client";

import BreedersDirectorySection from "@/components/animals/BreedersDirectorySection";

export default function BreedersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <BreedersDirectorySection />
      </div>
    </div>
  );
}
