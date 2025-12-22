"""
Django management command to auto-expire yard sale listings.
Run this periodically (e.g., daily via cron or Celery)

Usage: python manage.py expire_yard_sales
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from main.models import YardSaleListing


class Command(BaseCommand):
    help = 'Expire yard sale listings that have passed their end date'

    def handle(self, *args, **options):
        today = timezone.now().date()

        # Find all active listings that have expired
        expired_listings = YardSaleListing.objects.filter(
            status='active',
            end_date__lt=today
        )

        count = expired_listings.count()

        if count > 0:
            expired_listings.update(status='expired')
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully expired {count} yard sale listing(s)'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING('No listings to expire')
            )
