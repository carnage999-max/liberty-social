import AnimalListingDetail from "@/components/animals/AnimalListingDetail";

interface AnimalDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AnimalDetailPage({ params }: AnimalDetailPageProps) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <AnimalListingDetail id={id} />
      </div>
    </div>
  );
}
