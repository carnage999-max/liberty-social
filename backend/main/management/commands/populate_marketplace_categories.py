from django.core.management.base import BaseCommand
from django.utils.text import slugify
from main.marketplace_models import MarketplaceCategory


class Command(BaseCommand):
    help = "Populate marketplace categories"

    CATEGORIES = [
        "Electronics",
        "Vehicles",
        "Home & Living",
        "Fashion",
        "Health & Beauty",
        "Sports & Fitness",
        "Pets & Animals",
        "Real Estate",
        "Baby & Kids",
        "Food & Groceries",
        "Services",
        "Jobs",
        "Agriculture",
        "Industrial & Business",
        "Books, Art & Collectibles",
    ]

    def handle(self, *args, **options):
        created_count = 0
        existing_count = 0

        for category_name in self.CATEGORIES:
            slug = slugify(category_name)
            category, created = MarketplaceCategory.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": category_name,
                    "description": f"Browse {category_name.lower()} listings",
                    "is_active": True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"✓ Created category: {category_name}")
                )
            else:
                existing_count += 1
                self.stdout.write(
                    self.style.WARNING(f"- Category already exists: {category_name}")
                )

        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Operation completed: {created_count} created, {existing_count} already existed"
            )
        )
