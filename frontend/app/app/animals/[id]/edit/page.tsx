import AnimalListingForm from "@/components/animals/AnimalListingForm";

interface EditAnimalListingPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditAnimalListingPage({
  params,
}: EditAnimalListingPageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <AnimalListingForm listingId={id} />
      </div>
    </div>
  );
}
