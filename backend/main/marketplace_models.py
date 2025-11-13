from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericRelation
from django.core.validators import MinValueValidator


class MarketplaceCategory(models.Model):
    """Categories for marketplace listings."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    icon_url = models.URLField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Marketplace Categories"

    def __str__(self):
        return self.name


class MarketplaceListing(models.Model):
    """Main marketplace listing model."""

    CONDITION_CHOICES = (
        ("new", "New"),
        ("like_new", "Like New"),
        ("used", "Used"),
        ("fair", "Fair"),
        ("poor", "Poor"),
    )

    CONTACT_PREFERENCE_CHOICES = (
        ("chat", "Chat"),
        ("call", "Call"),
        ("both", "Both"),
    )

    DELIVERY_OPTIONS_CHOICES = (
        ("pickup", "Pickup"),
        ("delivery", "Delivery"),
        ("both", "Both"),
    )

    STATUS_CHOICES = (
        ("active", "Active"),
        ("sold", "Sold"),
        ("expired", "Expired"),
        ("draft", "Draft"),
    )

    # Basic info
    id = models.BigAutoField(primary_key=True)
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="marketplace_listings",
        on_delete=models.CASCADE,
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.ForeignKey(
        MarketplaceCategory,
        related_name="listings",
        on_delete=models.SET_NULL,
        null=True,
    )

    # Price and condition
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        default="used",
    )

    # Contact and delivery
    contact_preference = models.CharField(
        max_length=10,
        choices=CONTACT_PREFERENCE_CHOICES,
        default="both",
    )
    delivery_options = models.CharField(
        max_length=10,
        choices=DELIVERY_OPTIONS_CHOICES,
        default="both",
    )

    # Location
    location = models.CharField(max_length=255, blank=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)

    # Status and metadata
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
    )
    views_count = models.IntegerField(default=0)
    saved_count = models.IntegerField(default=0)
    messages_count = models.IntegerField(default=0)

    # Verification and moderation
    is_verified = models.BooleanField(default=False)
    reported_count = models.IntegerField(default=0)
    is_flagged = models.BooleanField(default=False)
    flagged_reason = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    sold_at = models.DateTimeField(blank=True, null=True)

    # Relations
    reactions = GenericRelation("main.Reaction", related_query_name="listing")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["seller", "status", "-created_at"]),
            models.Index(fields=["category", "status", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.title} - ${self.price}"


class MarketplaceListingMedia(models.Model):
    """Media (photos/videos) for marketplace listings."""

    listing = models.ForeignKey(
        MarketplaceListing,
        related_name="media",
        on_delete=models.CASCADE,
    )
    url = models.URLField()
    content_type = models.CharField(max_length=50, blank=True, null=True)
    order = models.IntegerField(default=0)  # For ordering images
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "uploaded_at"]

    def __str__(self):
        return f"Media for {self.listing_id}: {self.url}"


class MarketplaceSave(models.Model):
    """Saved/bookmarked listings."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="saved_listings",
        on_delete=models.CASCADE,
    )
    listing = models.ForeignKey(
        MarketplaceListing,
        related_name="saved_by",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("user", "listing"),)
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} saved {self.listing_id}"


class MarketplaceReport(models.Model):
    """Reports for inappropriate or problematic listings."""

    REASON_CHOICES = (
        ("inappropriate", "Inappropriate Content"),
        ("scam", "Scam or Fraud"),
        ("fake_item", "Fake or Counterfeit Item"),
        ("offensive", "Offensive or Hateful"),
        ("spam", "Spam"),
        ("stolen", "Stolen Item"),
        ("other", "Other"),
    )

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("under_review", "Under Review"),
        ("resolved", "Resolved"),
        ("dismissed", "Dismissed"),
    )

    listing = models.ForeignKey(
        MarketplaceListing,
        related_name="reports",
        on_delete=models.CASCADE,
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="marketplace_reports",
        on_delete=models.SET_NULL,
        null=True,
    )
    reason = models.CharField(
        max_length=50,
        choices=REASON_CHOICES,
    )
    description = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="marketplace_reports_reviewed",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    review_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report: {self.reason} for listing {self.listing_id}"


class MarketplaceOffer(models.Model):
    """Offers/negotiation for listings."""

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
        ("expired", "Expired"),
    )

    listing = models.ForeignKey(
        MarketplaceListing,
        related_name="offers",
        on_delete=models.CASCADE,
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="marketplace_offers_made",
        on_delete=models.CASCADE,
    )
    offered_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    message = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )
    responded_at = models.DateTimeField(blank=True, null=True)
    response_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = (("listing", "buyer"),)  # One offer per buyer per listing

    def __str__(self):
        return f"Offer: ${self.offered_price} for listing {self.listing_id}"


class SellerVerification(models.Model):
    """Seller verification status and badges."""

    VERIFICATION_TYPE_CHOICES = (
        ("phone", "Phone Verified"),
        ("email", "Email Verified"),
        ("id", "ID Verified"),
        ("address", "Address Verified"),
    )

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    )

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="marketplace_verifications",
        on_delete=models.CASCADE,
    )
    verification_type = models.CharField(
        max_length=20,
        choices=VERIFICATION_TYPE_CHOICES,
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )
    verified_at = models.DateTimeField(blank=True, null=True)
    verification_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-verified_at"]
        unique_together = (("seller", "verification_type"),)

    def __str__(self):
        return f"{self.seller} - {self.get_verification_type_display()}: {self.status}"
