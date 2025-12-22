"""
Yard Sale Listing Model
Map-based, time-limited yard sale discovery system
"""

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class YardSaleListing(models.Model):
    """
    Yard sale listing with geographic coordinates and time limits.
    Auto-expires after end_date.
    """

    STATUS_CHOICES = (
        ("active", "Active"),
        ("expired", "Expired"),
        ("archived", "Archived"),
        ("removed", "Removed"),
    )

    # Core fields
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="yard_sales"
    )

    title = models.CharField(max_length=255, help_text="e.g., 'Multi-Family Yard Sale'")
    description = models.TextField(
        blank=True, null=True, help_text="Items for sale, special notes, etc."
    )

    # Location
    address = models.CharField(max_length=500)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )

    # Time/Hours
    start_date = models.DateField()
    end_date = models.DateField()
    hours = models.CharField(
        max_length=100,
        default="9am - 4pm",
        help_text="e.g., '8am - 2pm' or '9am - 5pm'",
    )

    # Contact
    phone = models.CharField(
        max_length=20, blank=True, null=True, help_text="Optional seller contact number"
    )

    # Status & Metadata
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    price_paid = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.99,
        help_text="Listing fee paid by seller",
    )

    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(
        null=True, blank=True
    )  # Set to end_date + 24 hours

    # Engagement (optional, expandable)
    view_count = models.IntegerField(default=0)
    contact_count = models.IntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["latitude", "longitude"]),
            models.Index(fields=["status", "end_date"]),
            models.Index(fields=["created_at"]),
        ]
        verbose_name = "Yard Sale Listing"
        verbose_name_plural = "Yard Sale Listings"

    def __str__(self):
        return f"{self.title} - {self.address} ({self.start_date})"

    def is_active(self):
        """Check if listing is currently active."""
        today = timezone.now().date()
        return self.status == "active" and today <= self.end_date

    def is_today_only(self):
        """Check if sale is only happening today."""
        today = timezone.now().date()
        return self.start_date == self.end_date == today

    def is_multi_day(self):
        """Check if sale spans multiple days."""
        return self.start_date < self.end_date

    def pin_color(self):
        """Return color for map pin."""
        if self.is_today_only():
            return "blue"
        elif self.is_multi_day():
            return "orange"
        else:
            return "red"


class YardSaleReport(models.Model):
    """
    Track reports/issues with yard sale listings.
    Support moderation and safety.
    """

    REPORT_REASON_CHOICES = (
        ("inappropriate", "Inappropriate Content"),
        ("spam", "Spam"),
        ("fake", "Fake Listing"),
        ("scam", "Suspected Scam"),
        ("wrong_location", "Wrong Location"),
        ("duplicate", "Duplicate"),
        ("other", "Other"),
    )

    listing = models.ForeignKey(
        YardSaleListing, on_delete=models.CASCADE, related_name="reports"
    )
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="yard_sale_reports",
    )
    reason = models.CharField(max_length=50, choices=REPORT_REASON_CHOICES)
    description = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_yard_sale_reports",
    )
    action_taken = models.CharField(
        max_length=100, blank=True, null=True, help_text="Action taken by moderator"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report on {self.listing.title} - {self.reason}"
