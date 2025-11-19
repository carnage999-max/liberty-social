"use client";

import AnimalListingForm from "@/components/animals/AnimalListingForm";

export default function CreateAnimalListingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <AnimalListingForm />
      </div>
    </div>
  );
}
