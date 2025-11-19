"use client";

import AnimalListingDetail from "@/components/animals/AnimalListingDetail";

interface AnimalDetailPageProps {
  params: {
    id: string;
  };
}

export default function AnimalDetailPage({ params }: AnimalDetailPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <AnimalListingDetail id={params.id} />
      </div>
    </div>
  );
}
