"""
Animal Marketplace Models

Comprehensive animal sales platform with built-in verification,
legal compliance, and anti-scam features.
"""

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, URLValidator
from django.contrib.contenttypes.fields import GenericRelation
from django.core.exceptions import ValidationError
import json


class AnimalCategory(models.Model):
    """Animal marketplace categories with legality rules by state."""

    ANIMAL_TYPE_CHOICES = (
        ("dogs", "Dogs"),
        ("cats", "Cats"),
        ("birds", "Birds"),
        ("reptiles", "Reptiles"),
        ("small_mammals", "Small Mammals"),
        ("livestock", "Livestock"),
        ("exotics", "Exotics"),
        ("adoption_rehoming", "Adoption / Rehoming Only"),
    )

    name = models.CharField(max_length=100, unique=True)
    animal_type = models.CharField(max_length=50, choices=ANIMAL_TYPE_CHOICES)
    description = models.TextField(blank=True)
    icon_url = models.URLField(blank=True, null=True)

    # Legal restrictions by state (JSON format)
    # Example: {"CA": {"banned": true}, "TX": {"requires_license": true}}
    state_restrictions = models.JSONField(default=dict, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["animal_type", "name"]
        verbose_name_plural = "Animal Categories"
        indexes = [
            models.Index(fields=["animal_type", "is_active"]),
        ]

    def __str__(self):
        return f"{self.get_animal_type_display()} - {self.name}"

    def is_legal_in_state(self, state_code):
        """Check if this animal type is legal in the given state."""
        if not state_code:
            return None  # Unknown state

        restrictions = self.state_restrictions.get(state_code, {})

        if restrictions.get("banned"):
            return False
        return True

    def get_state_requirements(self, state_code):
        """Get any special requirements for selling in a state."""
        if not state_code:
            return {}
        return self.state_restrictions.get(state_code, {})


class AnimalSellerVerification(models.Model):
    """KYC/Identity verification for animal sellers."""

    VERIFICATION_STATUS_CHOICES = (
        ("pending", "Pending"),
        ("verified", "Verified"),
        ("rejected", "Rejected"),
        ("expired", "Expired"),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="animal_seller_verification",
    )

    # Personal information
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state_code = models.CharField(max_length=2)  # e.g., "CA", "TX"
    zip_code = models.CharField(max_length=10)

    # ID verification
    id_document_url = models.URLField(blank=True, null=True)
    id_type = models.CharField(
        max_length=50,
        choices=[
            ("drivers_license", "Driver's License"),
            ("passport", "Passport"),
            ("state_id", "State ID"),
        ],
        blank=True,
    )

    # Optional breeder license
    breeder_license_url = models.URLField(blank=True, null=True)
    breeder_license_number = models.CharField(max_length=100, blank=True)

    # Verification tracking
    status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUS_CHOICES,
        default="pending",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_sellers",
    )
    rejection_reason = models.TextField(blank=True)

    # Audit trail
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "Seller Verifications"
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "verified_at"]),
        ]

    def __str__(self):
        return f"Verification for {self.user.username} - {self.status}"

    @property
    def is_verified(self):
        """Check if seller is currently verified."""
        from django.utils import timezone

        if self.status != "verified":
            return False

        if self.expires_at and self.expires_at < timezone.now():
            return False

        return True

    @property
    def seller_badge_url(self):
        """Return badge URL if seller is verified."""
        if self.is_verified:
            return "/static/badges/verified-seller.svg"
        return None


class VetDocumentation(models.Model):
    """Veterinary documentation for animal listings."""

    DOCUMENTATION_TYPE_CHOICES = (
        ("vet_check", "Veterinary Check"),
        ("vaccination_record", "Vaccination Record"),
        ("health_certificate", "Health Certificate"),
        ("unknown", "Health Status Unknown"),
    )

    listing = models.OneToOneField(
        "AnimalListing",
        on_delete=models.CASCADE,
        related_name="vet_documentation",
    )

    documentation_type = models.CharField(
        max_length=50,
        choices=DOCUMENTATION_TYPE_CHOICES,
        default="unknown",
    )

    # Document storage
    document_url = models.URLField(blank=True, null=True)
    document_date = models.DateField(
        blank=True, null=True
    )  # Date of vet visit/vaccination

    # For "unknown" status
    unknown_disclaimer = models.BooleanField(
        default=False,
        help_text="Seller acknowledges health status is unknown",
    )

    # Additional notes
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Vet Documentations"

    def __str__(self):
        return f"Vet Doc for Listing {self.listing.id} - {self.get_documentation_type_display()}"

    def clean(self):
        """Validate documentation based on type."""
        if self.documentation_type == "unknown" and not self.unknown_disclaimer:
            raise ValidationError("Must acknowledge that health status is unknown.")

        if self.documentation_type != "unknown" and not self.document_url:
            raise ValidationError(
                f"Document URL required for {self.get_documentation_type_display()}"
            )


class AnimalListing(models.Model):
    """Animal sales listings with built-in safety features."""

    STATUS_CHOICES = (
        ("draft", "Draft"),
        ("active", "Active"),
        ("held", "Held"),
        ("sold", "Sold"),
        ("cancelled", "Cancelled"),
        ("flagged", "Flagged for Review"),
    )

    LISTING_TYPE_CHOICES = (
        ("sale", "Sale"),
        ("adoption", "Adoption"),
        ("rehoming", "Rehoming"),
    )

    # Basic info
    id = models.BigAutoField(primary_key=True)
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="animal_listings",
    )
    category = models.ForeignKey(
        AnimalCategory,
        on_delete=models.SET_NULL,
        null=True,
        related_name="listings",
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    listing_type = models.CharField(
        max_length=20,
        choices=LISTING_TYPE_CHOICES,
        default="sale",
    )

    # Animal details
    breed = models.CharField(max_length=255, blank=True)
    age_years = models.PositiveSmallIntegerField(blank=True, null=True)
    age_months = models.PositiveSmallIntegerField(blank=True, null=True)
    gender = models.CharField(
        max_length=20,
        choices=[("male", "Male"), ("female", "Female"), ("unknown", "Unknown")],
        blank=True,
    )
    color = models.CharField(max_length=255, blank=True)
    special_features = models.TextField(
        blank=True, help_text="e.g., hypoallergenic, trained, etc."
    )

    # Price (0 for adoption/rehoming without fee)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0,
    )
    rehoming_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        blank=True,
        null=True,
        help_text="For adoption/rehoming listings",
    )

    # Location
    location = models.CharField(max_length=255)
    state_code = models.CharField(max_length=2)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)

    # Contact preferences
    contact_preference = models.CharField(
        max_length=20,
        choices=[
            ("chat", "Chat only"),
            ("phone", "Phone only"),
            ("both", "Both"),
        ],
        default="both",
    )
    allow_shipping = models.BooleanField(
        default=False,
        help_text="Whether shipping/delivery of animal is allowed",
    )

    # Verification & compliance
    seller_verification = models.ForeignKey(
        AnimalSellerVerification,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="animal_listings",
    )

    # Legal status
    is_legal_in_state = models.BooleanField(
        default=True,
        help_text="Verified as legal in the listing state",
    )
    legal_check_date = models.DateTimeField(null=True, blank=True)
    legal_issues = models.TextField(
        blank=True,
        help_text="Any legal issues or requirements for this listing",
    )

    # Status & moderation
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
    )
    views_count = models.PositiveIntegerField(default=0)
    contact_count = models.PositiveIntegerField(default=0)

    # Scam detection flags
    suspicious_activity = models.BooleanField(default=False)
    scam_flags = models.JSONField(
        default=list,
        blank=True,
        help_text="Array of triggered scam detection flags",
    )
    review_note = models.TextField(blank=True, help_text="Admin notes for review")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Listing auto-expires after 90 days",
    )

    reactions = GenericRelation("main.Reaction", related_query_name="animal_listing")

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Animal Listings"
        indexes = [
            models.Index(fields=["category", "status", "-created_at"]),
            models.Index(fields=["seller", "status"]),
            models.Index(fields=["state_code", "status"]),
            models.Index(fields=["is_legal_in_state", "status"]),
            models.Index(fields=["suspicious_activity"]),
        ]

    def __str__(self):
        return f"{self.title} - {self.seller.username}"

    def clean(self):
        """Validate listing rules."""
        # Money rules for adoption/rehoming
        if self.listing_type in ["adoption", "rehoming"]:
            if self.listing_type == "adoption" and self.price > 0:
                raise ValidationError("Adoption listings cannot have a price.")

            if (
                self.listing_type == "rehoming"
                and self.price > 0
                and not self.rehoming_fee
            ):
                raise ValidationError(
                    "Rehoming listings with fees must use the rehoming_fee field, not price."
                )

    def check_legal_status(self):
        """Check if listing is legal in the state and set flags."""
        if not self.category or not self.state_code:
            return

        is_legal = self.category.is_legal_in_state(self.state_code)

        if is_legal is False:
            self.is_legal_in_state = False
            self.status = "flagged"
            self.legal_issues = f"{self.category.name} is banned in {self.state_code}"
            self.suspicious_activity = True
            if "banned_species" not in self.scam_flags:
                self.scam_flags.append("banned_species")
        else:
            self.is_legal_in_state = True

        from django.utils import timezone

        self.legal_check_date = timezone.now()

    def get_risk_score(self):
        """Calculate scam risk score (0-100)."""
        score = 0

        # Photo/media missing
        if not self.media_count:
            score += 15

        # Suspicious flags
        score += len(self.scam_flags) * 10

        # Unverified seller
        if not self.seller_verification or not self.seller_verification.is_verified:
            score += 20

        # No vet documentation for paid listings
        if self.price > 0 and not hasattr(self, "vet_documentation"):
            score += 10

        # New seller with activity
        from django.utils import timezone
        from datetime import timedelta

        if (timezone.now() - self.seller.date_joined) < timedelta(days=7):
            score += 10

        # Many listings flagged as sold but relisted
        resale_count = AnimalListing.objects.filter(
            seller=self.seller, status="sold"
        ).count()
        if resale_count > 10:
            score += 15

        return min(score, 100)

    @property
    def media_count(self):
        """Count associated media items."""
        return self.media.count() if hasattr(self, "media") else 0

    @property
    def seller_review_score(self):
        """Get seller's average review score."""
        if not hasattr(self, "seller_reviews"):
            return None

        reviews = self.seller_reviews.all()
        if not reviews.exists():
            return None

        avg_rating = reviews.aggregate(models.Avg("rating"))["rating__avg"]
        return round(avg_rating, 1) if avg_rating else None


class AnimalListingMedia(models.Model):
    """Media (photos/videos) for animal listings."""

    listing = models.ForeignKey(
        AnimalListing,
        on_delete=models.CASCADE,
        related_name="media",
    )
    url = models.URLField()
    media_type = models.CharField(
        max_length=20,
        choices=[
            ("photo", "Photo"),
            ("video", "Video"),
        ],
        default="photo",
    )
    is_primary = models.BooleanField(default=False)

    # AI-based stock photo detection
    is_stock_photo = models.BooleanField(
        default=False,
        help_text="AI detected as stock photo (scam risk)",
    )
    stock_photo_confidence = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0)],
        help_text="Confidence score 0-1.0 for stock photo detection",
    )

    uploaded_at = models.DateTimeField(auto_now_add=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "uploaded_at"]
        verbose_name_plural = "Animal Listing Media"
        indexes = [
            models.Index(fields=["listing", "is_primary"]),
        ]

    def __str__(self):
        return f"Media {self.id} for listing {self.listing.id}"


class SellerReview(models.Model):
    """Reviews for animal sellers after transactions."""

    listing = models.ForeignKey(
        AnimalListing,
        on_delete=models.CASCADE,
        related_name="seller_reviews",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="seller_reviews_given",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="animal_reviews_received",
    )

    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Rating 1-5 stars",
    )
    title = models.CharField(max_length=255, blank=True)
    comment = models.TextField(blank=True)

    # Review aspects
    accuracy = models.BooleanField(
        default=True,
        help_text="Listing accurately described the animal",
    )
    health = models.BooleanField(
        default=True,
        help_text="Animal arrived in good health",
    )
    communication = models.BooleanField(
        default=True,
        help_text="Seller communicated clearly",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("listing", "buyer")
        indexes = [
            models.Index(fields=["seller", "-created_at"]),
        ]

    def __str__(self):
        return f"Review by {self.buyer.username} for {self.seller.username}"


class SuspiciousActivityLog(models.Model):
    """Log of suspicious activities for fraud detection."""

    ACTIVITY_TYPE_CHOICES = (
        ("price_manipulation", "Price Manipulation"),
        ("high_contact_rate", "High Contact Rate"),
        ("rapid_relisting", "Rapid Relisting"),
        ("photo_theft", "Stock Photo Detected"),
        ("unverified_seller", "Unverified Seller Activity"),
        ("location_mismatch", "Location Mismatch"),
        ("banned_species", "Banned Species"),
        ("multiple_flagging", "Multiple User Flags"),
    )

    listing = models.ForeignKey(
        AnimalListing,
        on_delete=models.CASCADE,
        related_name="suspicious_logs",
    )
    activity_type = models.CharField(
        max_length=50,
        choices=ACTIVITY_TYPE_CHOICES,
    )
    description = models.TextField()
    severity = models.CharField(
        max_length=20,
        choices=[
            ("low", "Low"),
            ("medium", "Medium"),
            ("high", "High"),
            ("critical", "Critical"),
        ],
        default="medium",
    )
    is_resolved = models.BooleanField(default=False)
    resolution_note = models.TextField(blank=True)

    detected_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-detected_at"]
        verbose_name_plural = "Suspicious Activity Logs"
        indexes = [
            models.Index(fields=["listing", "is_resolved"]),
        ]

    def __str__(self):
        return f"{self.activity_type} - Listing {self.listing.id}"


class BreederDirectory(models.Model):
    """Premium directory listing for verified breeders."""

    seller = models.OneToOneField(
        AnimalSellerVerification,
        on_delete=models.CASCADE,
        related_name="breeder_directory",
    )

    # Profile info
    breeder_name = models.CharField(max_length=255)
    bio = models.TextField(blank=True)
    website = models.URLField(blank=True, null=True)

    # Specializations
    specialties = models.JSONField(
        default=list,
        help_text="List of animal types breeder specializes in",
    )

    # Ratings aggregated from reviews
    average_rating = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0)],
    )
    total_reviews = models.PositiveIntegerField(default=0)

    # Premium features
    is_featured = models.BooleanField(default=False)
    featured_until = models.DateTimeField(null=True, blank=True)
    subscription_status = models.CharField(
        max_length=20,
        choices=[
            ("inactive", "Inactive"),
            ("active", "Active"),
            ("suspended", "Suspended"),
        ],
        default="inactive",
    )

    # Listing info
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Breeder Directories"

    def __str__(self):
        return f"Breeder: {self.breeder_name}"
