from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404

from .marketplace_models import (
    MarketplaceCategory,
    MarketplaceListing,
    MarketplaceListingMedia,
    MarketplaceSave,
    MarketplaceReport,
    MarketplaceOffer,
    SellerVerification,
)
from .serializers import (
    MarketplaceCategorySerializer,
    MarketplaceListingSerializer,
    MarketplaceListingMediaSerializer,
    MarketplaceSaveSerializer,
    MarketplaceReportSerializer,
    MarketplaceOfferSerializer,
    SellerVerificationSerializer,
)


class MarketplaceCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """View categories for marketplace listings."""

    queryset = MarketplaceCategory.objects.filter(is_active=True)
    serializer_class = MarketplaceCategorySerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"


class MarketplaceListingViewSet(viewsets.ModelViewSet):
    """View and manage marketplace listings."""

    serializer_class = MarketplaceListingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description", "location"]
    ordering_fields = ["created_at", "price", "views_count"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = (
            MarketplaceListing.objects.filter(status="active")
            .select_related("seller", "category")
            .prefetch_related("media", "reactions")
        )

        # Filter by category
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__slug=category)

        # Filter by price range
        min_price = self.request.query_params.get("min_price")
        max_price = self.request.query_params.get("max_price")
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        # Filter by condition
        condition = self.request.query_params.get("condition")
        if condition:
            queryset = queryset.filter(condition=condition)

        # Filter by location (simple substring match, could use geo queries)
        location = self.request.query_params.get("location")
        if location:
            queryset = queryset.filter(location__icontains=location)

        return queryset

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)

    def perform_update(self, serializer):
        listing = self.get_object()
        if listing.seller != self.request.user:
            raise PermissionDenied("You can only edit your own listings.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.seller != self.request.user:
            raise PermissionDenied("You can only delete your own listings.")
        instance.delete()

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def my_listings(self, request):
        """Get current user's listings."""
        listings = (
            MarketplaceListing.objects.filter(seller=request.user)
            .select_related("category")
            .prefetch_related("media")
        )

        status_filter = request.query_params.get("status")
        if status_filter:
            listings = listings.filter(status=status_filter)

        page = self.paginate_queryset(listings)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(listings, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def view(self, request, pk=None):
        """Increment view count."""
        listing = self.get_object()
        listing.views_count = Count("views_count") + 1
        listing.save(update_fields=["views_count"])
        return Response({"views_count": listing.views_count})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def save(self, request, pk=None):
        """Save/bookmark a listing."""
        listing = self.get_object()
        save_obj, created = MarketplaceSave.objects.get_or_create(
            user=request.user, listing=listing
        )
        if not created:
            save_obj.delete()
            saved = False
        else:
            saved = True

        return Response({"saved": saved, "saved_count": listing.saved_count})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def report(self, request, pk=None):
        """Report a listing."""
        listing = self.get_object()

        serializer = MarketplaceReportSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(listing=listing, reporter=request.user)
            listing.reported_count += 1
            listing.save(update_fields=["reported_count"])
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def mark_sold(self, request, pk=None):
        """Mark listing as sold."""
        listing = self.get_object()
        if listing.seller != request.user:
            raise PermissionDenied("You can only mark your own listings as sold.")

        listing.status = "sold"
        listing.sold_at = timezone.now()
        listing.save(update_fields=["status", "sold_at"])

        serializer = self.get_serializer(listing)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def trending(self, request):
        """Get trending listings."""
        listings = (
            MarketplaceListing.objects.filter(
                status="active",
                created_at__gte=timezone.now() - timezone.timedelta(days=7),
            )
            .annotate(activity=Count("saved_by") + Count("offers"))
            .order_by("-activity")[:20]
        )

        serializer = self.get_serializer(listings, many=True)
        return Response(serializer.data)


class MarketplaceOfferViewSet(viewsets.ModelViewSet):
    """Make and manage offers on listings."""

    serializer_class = MarketplaceOfferSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users can see their own offers and offers on their listings
        return MarketplaceOffer.objects.filter(
            Q(buyer=self.request.user) | Q(listing__seller=self.request.user)
        ).select_related("listing", "buyer")

    def perform_create(self, serializer):
        listing = serializer.validated_data["listing"]

        # Check if user already made an offer
        existing = MarketplaceOffer.objects.filter(
            listing=listing, buyer=self.request.user
        ).first()

        if existing:
            return Response(
                {"error": "You already made an offer on this listing."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer.save(buyer=self.request.user)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def accept(self, request, pk=None):
        """Accept an offer."""
        offer = self.get_object()
        listing = offer.listing

        if listing.seller != request.user:
            raise PermissionDenied("Only the seller can accept offers.")

        offer.status = "accepted"
        offer.responded_at = timezone.now()
        offer.save()

        # Mark listing as sold
        listing.status = "sold"
        listing.sold_at = timezone.now()
        listing.save()

        serializer = self.get_serializer(offer)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def decline(self, request, pk=None):
        """Decline an offer."""
        offer = self.get_object()
        listing = offer.listing

        if listing.seller != request.user:
            raise PermissionDenied("Only the seller can decline offers.")

        offer.status = "declined"
        offer.responded_at = timezone.now()
        offer.response_message = request.data.get("message", "")
        offer.save()

        serializer = self.get_serializer(offer)
        return Response(serializer.data)


class MarketplaceSaveViewSet(viewsets.ReadOnlyModelViewSet):
    """View saved listings."""

    serializer_class = MarketplaceSaveSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            MarketplaceSave.objects.filter(user=self.request.user)
            .select_related("listing")
            .order_by("-created_at")
        )


class SellerVerificationViewSet(viewsets.ReadOnlyModelViewSet):
    """View seller verification status."""

    serializer_class = SellerVerificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SellerVerification.objects.filter(seller=self.request.user).order_by(
            "-verified_at"
        )

    @action(detail=False, methods=["get"])
    def my_verifications(self, request):
        """Get current user's verifications."""
        verifications = self.get_queryset()
        serializer = self.get_serializer(verifications, many=True)
        return Response(serializer.data)


class MarketplaceListingMediaViewSet(viewsets.ModelViewSet):
    """Manage media for marketplace listings."""

    serializer_class = MarketplaceListingMediaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users can manage media for their own listings
        return MarketplaceListingMedia.objects.filter(
            listing__seller=self.request.user
        ).select_related("listing")

    def perform_create(self, serializer):
        listing = serializer.validated_data["listing"]
        if listing.seller != self.request.user:
            raise PermissionDenied("You can only add media to your own listings.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.listing.seller != self.request.user:
            raise PermissionDenied("You can only delete media from your own listings.")
        instance.delete()
