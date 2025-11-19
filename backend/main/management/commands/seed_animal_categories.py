"""
Management command to seed animal categories
Usage: python manage.py seed_animal_categories
"""

from django.core.management.base import BaseCommand
from main.animal_models import AnimalCategory


class Command(BaseCommand):
    help = "Seeds the database with default animal categories"

    def handle(self, *args, **options):
        categories_data = [
            {
                "name": "Golden Retriever",
                "animal_type": "dogs",
                "description": "Friendly and intelligent dog breed",
            },
            {
                "name": "Labrador Retriever",
                "animal_type": "dogs",
                "description": "Popular family dog breed",
            },
            {
                "name": "German Shepherd",
                "animal_type": "dogs",
                "description": "Smart and loyal working dog",
            },
            {
                "name": "French Bulldog",
                "animal_type": "dogs",
                "description": "Small and affectionate companion",
            },
            {
                "name": "Beagle",
                "animal_type": "dogs",
                "description": "Small hound dog breed",
            },
            {
                "name": "Dachshund",
                "animal_type": "dogs",
                "description": "Small dog with distinctive long body",
            },
            {
                "name": "Persian Cat",
                "animal_type": "cats",
                "description": "Long-haired cat breed with flat face",
            },
            {
                "name": "Siamese Cat",
                "animal_type": "cats",
                "description": "Vocal and social cat breed",
            },
            {
                "name": "Maine Coon",
                "animal_type": "cats",
                "description": "Large and friendly cat breed",
            },
            {
                "name": "British Shorthair",
                "animal_type": "cats",
                "description": "Stocky cat with round face",
            },
            {
                "name": "Parrot",
                "animal_type": "birds",
                "description": "Colorful and intelligent bird",
            },
            {
                "name": "Canary",
                "animal_type": "birds",
                "description": "Small singing bird",
            },
            {
                "name": "Cockatiel",
                "animal_type": "birds",
                "description": "Medium-sized crested parrot",
            },
            {
                "name": "Ball Python",
                "animal_type": "reptiles",
                "description": "Popular pet snake species",
            },
            {
                "name": "Bearded Dragon",
                "animal_type": "reptiles",
                "description": "Docile and sociable lizard",
            },
            {
                "name": "Guinea Pig",
                "animal_type": "small_mammals",
                "description": "Friendly rodent pet",
            },
            {
                "name": "Rabbit",
                "animal_type": "small_mammals",
                "description": "Hopping pet mammal",
            },
            {
                "name": "Hamster",
                "animal_type": "small_mammals",
                "description": "Small furry rodent",
            },
            {
                "name": "Dairy Cow",
                "animal_type": "livestock",
                "description": "For milk production",
            },
            {
                "name": "Chicken",
                "animal_type": "livestock",
                "description": "For eggs and meat",
            },
            {
                "name": "Sheep",
                "animal_type": "livestock",
                "description": "For wool and meat",
            },
            {
                "name": "Exotic Fish",
                "animal_type": "exotics",
                "description": "Rare ornamental fish species",
            },
            {
                "name": "Adoption & Rehoming",
                "animal_type": "adoption_rehoming",
                "description": "Animals needing new homes",
            },
        ]

        created_count = 0
        skipped_count = 0

        for category_data in categories_data:
            category, created = AnimalCategory.objects.get_or_create(
                name=category_data["name"],
                defaults={
                    "animal_type": category_data["animal_type"],
                    "description": category_data["description"],
                    "is_active": True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"✓ Created: {category.name}"))
            else:
                skipped_count += 1
                self.stdout.write(f"⊘ Already exists: {category.name}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✓ Seeding complete! Created: {created_count}, Skipped: {skipped_count}"
            )
        )
