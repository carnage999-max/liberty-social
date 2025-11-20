"""
Animal Marketplace Serializers

REST API serializers for animal listings, verification, and reviews.
"""

from rest_framework import serializers
from django.utils import timezone
from django.contrib.auth import get_user_model
from .animal_models import (
    AnimalCategory,
    AnimalSellerVerification,
    VetDocumentation,
    AnimalListing,
    AnimalListingMedia,
    SellerReview,
    SuspiciousActivityLog,
    BreederDirectory,
)
from users.serializers import UserSerializer

User = get_user_model()


class AnimalCategorySerializer(serializers.ModelSerializer):
    """Serializer for animal categories with state legality info."""

    class Meta:
        model = AnimalCategory
        fields = [
            "id",
            "name",
            "animal_type",
            "description",
            "icon_url",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AnimalSellerVerificationSerializer(serializers.ModelSerializer):
    """Serializer for seller verification status."""

    user = UserSerializer(read_only=True)
    is_verified = serializers.SerializerMethodField()
    seller_badge_url = serializers.SerializerMethodField()

    class Meta:
        model = AnimalSellerVerification
        fields = [
            "id",
            "user",
            "full_name",
            "phone_number",
            "address",
            "city",
            "state_code",
            "zip_code",
            "id_type",
            "breeder_license_number",
            "status",
            "verified_at",
            "expires_at",
            "is_verified",
            "seller_badge_url",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "status",
            "verified_at",
            "seller_badge_url",
            "created_at",
        ]
        extra_kwargs = {
            "id_document_url": {"write_only": True},
            "breeder_license_url": {"write_only": True},
        }

    def get_is_verified(self, obj):
        return obj.is_verified

    def get_seller_badge_url(self, obj):
        return obj.seller_badge_url

    def create(self, validated_data):
        """Create verification and auto-set user from request context."""
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            validated_data["user"] = request.user
        return super().create(validated_data)


class VetDocumentationSerializer(serializers.ModelSerializer):
    """Serializer for veterinary documentation."""

    class Meta:
        model = VetDocumentation
        fields = [
            "id",
            "documentation_type",
            "document_url",
            "document_date",
            "unknown_disclaimer",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AnimalListingMediaSerializer(serializers.ModelSerializer):
    """Serializer for animal listing media."""

    class Meta:
        model = AnimalListingMedia
        fields = [
            "id",
            "url",
            "media_type",
            "is_primary",
            "is_stock_photo",
            "stock_photo_confidence",
            "order",
        ]
        read_only_fields = ["id", "is_stock_photo", "stock_photo_confidence"]


class SellerReviewSerializer(serializers.ModelSerializer):
    """Serializer for seller reviews."""

    buyer = UserSerializer(read_only=True)
    seller = UserSerializer(read_only=True)

    class Meta:
        model = SellerReview
        fields = [
            "id",
            "listing",
            "buyer",
            "seller",
            "rating",
            "title",
            "comment",
            "accuracy",
            "health",
            "communication",
            "created_at",
        ]
        read_only_fields = ["id", "buyer", "seller", "created_at"]

    def create(self, validated_data):
        """Create review and set buyer from request context."""
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            validated_data["buyer"] = request.user
            listing = validated_data.get("listing")
            if listing:
                validated_data["seller"] = listing.seller
        return super().create(validated_data)


class AnimalListingDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for animal listings with all relationships."""

    seller = UserSerializer(read_only=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=AnimalCategory.objects.all(),
        required=False,
    )
    category_name = serializers.SerializerMethodField()
    seller_verification = AnimalSellerVerificationSerializer(read_only=True)
    vet_documentation = VetDocumentationSerializer(read_only=True)
    media = AnimalListingMediaSerializer(many=True, read_only=True)
    seller_reviews = SellerReviewSerializer(many=True, read_only=True)
    media_urls = serializers.ListField(
        child=serializers.URLField(),
        write_only=True,
        required=False,
    )
    risk_score = serializers.SerializerMethodField()
    seller_rating = serializers.SerializerMethodField()

    def get_category_name(self, obj):
        """Get the category name for display."""
        if obj.category:
            return obj.category.name
        return None

    class Meta:
        model = AnimalListing
        fields = [
            "id",
            "seller",
            "category",
            "category_name",
            "title",
            "description",
            "listing_type",
            "breed",
            "age_years",
            "age_months",
            "gender",
            "color",
            "special_features",
            "price",
            "rehoming_fee",
            "location",
            "state_code",
            "latitude",
            "longitude",
            "contact_preference",
            "allow_shipping",
            "seller_verification",
            "is_legal_in_state",
            "status",
            "views_count",
            "contact_count",
            "media",
            "media_urls",
            "vet_documentation",
            "seller_reviews",
            "risk_score",
            "seller_rating",
            "created_at",
            "updated_at",
            "expires_at",
        ]
        read_only_fields = [
            "id",
            "seller",
            "status",
            "views_count",
            "contact_count",
            "is_legal_in_state",
            "risk_score",
            "seller_rating",
            "created_at",
            "updated_at",
        ]

    def get_risk_score(self, obj):
        """Calculate and return risk score."""
        return obj.get_risk_score()

    def get_seller_rating(self, obj):
        """Get seller's average rating from reviews."""
        return obj.seller_review_score

    def create(self, validated_data):
        """Create listing with media and perform legal checks."""
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            validated_data["seller"] = request.user

        media_urls = validated_data.pop("media_urls", [])

        listing = super().create(validated_data)

        # Check legal status
        listing.check_legal_status()
        listing.save()

        # Add media
        for index, url in enumerate(media_urls):
            is_primary = index == 0
            AnimalListingMedia.objects.create(
                listing=listing,
                url=url,
                is_primary=is_primary,
                order=index,
            )

        return listing

    def update(self, instance, validated_data):
        """Update listing and re-check legal status."""
        media_urls = validated_data.pop("media_urls", [])

        instance = super().update(instance, validated_data)

        # Re-check legal status if category or state changed
        if "category" in validated_data or "state_code" in validated_data:
            instance.check_legal_status()
            instance.save()

        # Update media if provided
        if media_urls:
            instance.media.all().delete()
            for index, url in enumerate(media_urls):
                is_primary = index == 0
                AnimalListingMedia.objects.create(
                    listing=instance,
                    url=url,
                    is_primary=is_primary,
                    order=index,
                )

        return instance


class AnimalListingListSerializer(serializers.ModelSerializer):
    """List serializer for animal listings (lightweight)."""

    seller = UserSerializer(read_only=True)
    category = AnimalCategorySerializer(read_only=True)
    primary_image = serializers.SerializerMethodField()
    animal_listing_media = serializers.SerializerMethodField()
    risk_score = serializers.SerializerMethodField()
    seller_verified = serializers.SerializerMethodField()

    class Meta:
        model = AnimalListing
        fields = [
            "id",
            "title",
            "breed",
            "age_years",
            "age_months",
            "price",
            "location",
            "state_code",
            "listing_type",
            "seller",
            "category",
            "primary_image",
            "animal_listing_media",
            "risk_score",
            "seller_verified",
            "status",
            "views_count",
            "created_at",
        ]
        read_only_fields = fields

    def get_primary_image(self, obj):
        """Get URL of primary image."""
        media = obj.media.filter(is_primary=True).first()
        return media.url if media else None

    def get_animal_listing_media(self, obj):
        """Get all media for listing."""
        media_items = obj.media.all()
        return [{"id": m.id, "url": m.url, "media_type": m.media_type} for m in media_items]

    def get_risk_score(self, obj):
        """Get risk score for listing."""
        return obj.get_risk_score()

    def get_seller_verified(self, obj):
        """Check if seller is verified."""
        if obj.seller_verification:
            return obj.seller_verification.is_verified
        return False


class BreederDirectorySerializer(serializers.ModelSerializer):
    """Serializer for breeder directory listings."""

    seller = serializers.SerializerMethodField()
    specialties = serializers.JSONField()

    class Meta:
        model = BreederDirectory
        fields = [
            "id",
            "seller",
            "breeder_name",
            "bio",
            "website",
            "specialties",
            "average_rating",
            "total_reviews",
            "is_featured",
            "featured_until",
            "subscription_status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "seller",
            "average_rating",
            "total_reviews",
            "created_at",
        ]

    def get_seller(self, obj):
        """Get seller info from verification."""
        if obj.seller:
            return UserSerializer(obj.seller.user).data
        return None
