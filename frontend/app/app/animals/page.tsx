"use client";

import AnimalListingsSection from "@/components/animals/AnimalListingsSection";

export default function AnimalsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <AnimalListingsSection />
      </div>
    </div>
  );
}
