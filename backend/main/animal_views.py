"""
Animal Marketplace ViewSets

REST API endpoints for animal listings, verification, and reviews.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from django.db.models import Q, Avg
from django.shortcuts import get_object_or_404
from datetime import timedelta

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
from .animal_serializers import (
    AnimalCategorySerializer,
    AnimalSellerVerificationSerializer,
    VetDocumentationSerializer,
    AnimalListingDetailSerializer,
    AnimalListingListSerializer,
    AnimalListingMediaSerializer,
    SellerReviewSerializer,
    BreederDirectorySerializer,
)


class AnimalCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for animal categories."""

    queryset = AnimalCategory.objects.filter(is_active=True)
    serializer_class = AnimalCategorySerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=["get"])
    def by_type(self, request):
        """Get categories grouped by animal type."""
        animal_type = request.query_params.get("type")

        if animal_type:
            categories = self.queryset.filter(animal_type=animal_type)
        else:
            categories = self.queryset

        serializer = self.get_serializer(categories, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def legality(self, request, pk=None):
        """Check legality of category in a specific state."""
        category = self.get_object()
        state_code = request.query_params.get("state")

        if not state_code or len(state_code) != 2:
            return Response(
                {"error": "State code required (e.g., 'CA')"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_legal = category.is_legal_in_state(state_code)
        requirements = category.get_state_requirements(state_code)

        return Response(
            {
                "category": category.name,
                "state": state_code,
                "is_legal": is_legal,
                "requirements": requirements,
            }
        )


class AnimalSellerVerificationViewSet(viewsets.ModelViewSet):
    """ViewSet for seller verification (KYC)."""

    serializer_class = AnimalSellerVerificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return own verification or admin can view all."""
        if self.request.user.is_staff:
            return AnimalSellerVerification.objects.all()
        return AnimalSellerVerification.objects.filter(user=self.request.user)

    def get_object(self):
        """Get user's own verification."""
        return get_object_or_404(AnimalSellerVerification, user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Create or update seller verification."""
        verification, created = AnimalSellerVerification.objects.get_or_create(
            user=request.user
        )

        serializer = self.get_serializer(
            verification, data=request.data, partial=not created
        )
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def perform_update(self, serializer):
        """Update verification and reset status if not yet verified."""
        verification = serializer.save()

        # If updating an unverified application, reset status
        if verification.status != "verified":
            verification.status = "pending"
            verification.save()

    @action(detail=False, methods=["get"])
    def status(self, request):
        """Check current verification status."""
        try:
            verification = AnimalSellerVerification.objects.get(user=request.user)
            serializer = self.get_serializer(verification)
            return Response(serializer.data)
        except AnimalSellerVerification.DoesNotExist:
            return Response(
                {"message": "No verification found. Submit one to get started."},
                status=status.HTTP_404_NOT_FOUND,
            )


class AnimalListingViewSet(viewsets.ModelViewSet):
    """ViewSet for animal listings."""

    # Allow anonymous users to view listings (list/retrieve), but require
    # authentication for create/update/delete actions.
    # Use get_permissions to return different permission classes per action.
    filterset_fields = [
        "category",
        "state_code",
        "listing_type",
        "status",
        "price",
    ]

    def get_queryset(self):
        """Get filtered listings based on user permissions."""
        queryset = (
            AnimalListing.objects.select_related(
                "seller", "category", "seller_verification"
            )
            .prefetch_related("media", "seller_reviews")
            .filter(status__in=["active", "held", "sold"])
        )

        # Filter by state if provided
        state_code = self.request.query_params.get("state")
        if state_code:
            queryset = queryset.filter(state_code=state_code)

        # Filter by price range
        min_price = self.request.query_params.get("min_price")
        max_price = self.request.query_params.get("max_price")
        if min_price:
            queryset = queryset.filter(price__gte=float(min_price))
        if max_price:
            queryset = queryset.filter(price__lte=float(max_price))

        # Search
        search_query = self.request.query_params.get("q")
        if search_query:
            queryset = queryset.filter(
                Q(title__icontains=search_query)
                | Q(description__icontains=search_query)
                | Q(breed__icontains=search_query)
            )

        return queryset.order_by("-created_at")

    def get_permissions(self):
        """Use looser permissions for read-only actions."""
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        """Use list serializer for list view, detail for others."""
        if self.action == "list":
            return AnimalListingListSerializer
        return AnimalListingDetailSerializer

    def perform_create(self, serializer):
        """Create listing and set seller."""
        listing = serializer.save(seller=self.request.user)

        # Auto-activate listing on creation
        listing.status = "active"

        # Check seller verification
        try:
            verification = AnimalSellerVerification.objects.get(
                user=self.request.user,
                status="verified",
            )
            listing.seller_verification = verification
        except AnimalSellerVerification.DoesNotExist:
            pass

        # Perform legal check
        listing.check_legal_status()
        listing.save()

    def perform_update(self, serializer):
        """Update listing and ensure seller permission."""
        instance = serializer.instance

        if instance.seller != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("You can only edit your own listings.")

        serializer.save()

    def perform_destroy(self, instance):
        """Soft delete by marking as cancelled."""
        if instance.seller != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("You can only delete your own listings.")

        instance.status = "cancelled"
        instance.save()

    @action(detail=True, methods=["post"])
    def increment_view(self, request, pk=None):
        """Increment view count for listing."""
        listing = self.get_object()
        listing.views_count += 1
        listing.save(update_fields=["views_count"])
        return Response({"views_count": listing.views_count})

    @action(detail=True, methods=["post"])
    def report_suspicious(self, request, pk=None):
        """Report suspicious activity on listing."""
        listing = self.get_object()
        activity_type = request.data.get("activity_type")
        description = request.data.get("description", "")

        if not activity_type:
            return Response(
                {"error": "activity_type required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        SuspiciousActivityLog.objects.create(
            listing=listing,
            activity_type=activity_type,
            description=description,
            severity="medium",
        )

        listing.suspicious_activity = True
        if activity_type not in listing.scam_flags:
            listing.scam_flags.append(activity_type)
        listing.save()

        return Response(
            {"message": "Report submitted", "risk_score": listing.get_risk_score()}
        )

    @action(detail=False, methods=["get"])
    def my_listings(self, request):
        """Get authenticated user's listings."""
        queryset = (
            AnimalListing.objects.filter(seller=request.user)
            .select_related("category")
            .prefetch_related("media")
        )

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = AnimalListingListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = AnimalListingListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def seller_profile(self, request, pk=None):
        """Get seller profile with reviews and ratings."""
        listing = self.get_object()
        seller = listing.seller

        all_listings = AnimalListing.objects.filter(
            seller=seller, status="sold"
        ).count()
        all_reviews = SellerReview.objects.filter(seller=seller)
        avg_rating = all_reviews.aggregate(Avg("rating"))["rating__avg"]

        return Response(
            {
                "seller": {
                    "id": seller.id,
                    "username": seller.username,
                    "first_name": seller.first_name,
                    "last_name": seller.last_name,
                },
                "verification": (
                    SellerVerificationSerializer(seller.animal_seller_verification).data
                    if hasattr(seller, "animal_seller_verification")
                    else None
                ),
                "listings_sold": all_listings,
                "average_rating": round(avg_rating, 1) if avg_rating else 0,
                "review_count": all_reviews.count(),
                "recent_reviews": SellerReviewSerializer(
                    all_reviews.order_by("-created_at")[:5], many=True
                ).data,
            }
        )


class AnimalListingMediaViewSet(viewsets.ModelViewSet):
    """ViewSet for animal listing media."""

    serializer_class = AnimalListingMediaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Get media for user's listings."""
        listing_id = self.request.query_params.get("listing")
        if listing_id:
            listing = get_object_or_404(AnimalListing, id=listing_id)
            if listing.seller != self.request.user:
                raise PermissionDenied("Cannot access this listing's media.")
            return listing.media.all()
        return AnimalListingMedia.objects.none()

    def perform_create(self, serializer):
        """Create media for listing."""
        listing_id = self.request.data.get("listing_id")
        listing = get_object_or_404(AnimalListing, id=listing_id)

        if listing.seller != self.request.user:
            raise PermissionDenied("Cannot add media to this listing.")

        serializer.save(listing=listing)


class SellerReviewViewSet(viewsets.ModelViewSet):
    """ViewSet for seller reviews."""

    serializer_class = SellerReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Get reviews for seller or by user."""
        seller_id = self.request.query_params.get("seller")
        if seller_id:
            return SellerReview.objects.filter(seller_id=seller_id)

        return SellerReview.objects.filter(buyer=self.request.user)

    def perform_create(self, serializer):
        """Create review and validate listing ownership."""
        listing = serializer.validated_data.get("listing")

        # Verify user bought from this seller
        if listing.seller == self.request.user:
            raise ValidationError("Cannot review your own listings.")

        # Check if review already exists
        if SellerReview.objects.filter(
            listing=listing, buyer=self.request.user
        ).exists():
            raise ValidationError("You already reviewed this transaction.")

        serializer.save(buyer=self.request.user, seller=listing.seller)

        # Update seller's average rating
        avg_rating = SellerReview.objects.filter(seller=listing.seller).aggregate(
            Avg("rating")
        )["rating__avg"]

        if listing.seller_verification:
            listing.seller_verification.average_rating = avg_rating or 0
            listing.seller_verification.save(update_fields=["average_rating"])


class BreederDirectoryViewSet(viewsets.ModelViewSet):
    """ViewSet for premium breeder directory."""

    serializer_class = BreederDirectorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Get active breeder listings."""
        return BreederDirectory.objects.filter(
            subscription_status="active"
        ).select_related("seller")

    def create(self, request, *args, **kwargs):
        """Create breeder directory entry for user."""
        try:
            verification = AnimalSellerVerification.objects.get(user=request.user)
            if not verification.is_verified:
                return Response(
                    {
                        "error": "You must be a verified seller to list in the directory."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            breeder_dir, created = BreederDirectory.objects.get_or_create(
                seller=verification
            )
            serializer = self.get_serializer(
                breeder_dir, data=request.data, partial=not created
            )
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )

        except AnimalSellerVerification.DoesNotExist:
            return Response(
                {"error": "No verification found. Please verify as a seller first."},
                status=status.HTTP_404_NOT_FOUND,
            )

    @action(detail=False, methods=["get"])
    def search(self, request):
        """Search breeder directory."""
        query = request.query_params.get("q")
        specialties = request.query_params.get("specialties")

        queryset = self.get_queryset()

        if query:
            queryset = queryset.filter(
                Q(breeder_name__icontains=query) | Q(bio__icontains=query)
            )

        if specialties:
            specialties_list = specialties.split(",")
            for specialty in specialties_list:
                queryset = queryset.filter(specialties__contains=specialty)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def upgrade_subscription(self, request):
        """Upgrade to premium breeder listing."""
        try:
            breeder_dir = BreederDirectory.objects.get(seller__user=request.user)
            days = int(request.data.get("days", 30))
            breeder_dir.subscription_status = "active"
            breeder_dir.featured_until = timezone.now() + timedelta(days=days)
            breeder_dir.save()

            return Response(
                {
                    "message": "Subscription upgraded",
                    "featured_until": breeder_dir.featured_until,
                }
            )
        except BreederDirectory.DoesNotExist:
            return Response(
                {"error": "Breeder directory entry not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
