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
from rest_framework.exceptions import ValidationError
from .emails import (
    send_offer_received_email,
    send_offer_accepted_email,
    send_offer_declined_email,
)
from .slug_utils import SlugOrIdLookupMixin
from .moderation.pipeline import precheck_text_or_raise, record_text_classification
from .moderation.throttling import enforce_throttle
import logging

logger = logging.getLogger(__name__)


class MarketplaceCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """View categories for marketplace listings."""

    queryset = MarketplaceCategory.objects.filter(is_active=True)
    serializer_class = MarketplaceCategorySerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"


class MarketplaceListingViewSet(SlugOrIdLookupMixin, viewsets.ModelViewSet):
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

        # Filter by seller ID
        seller_id = self.request.query_params.get("seller_id") or self.request.query_params.get("seller")
        if seller_id:
            queryset = queryset.filter(seller_id=seller_id)

        return queryset

    def perform_create(self, serializer):
        title = serializer.validated_data.get("title") or ""
        description = serializer.validated_data.get("description") or ""
        location = serializer.validated_data.get("location") or ""
        enforce_throttle(
            actor=self.request.user,
            context="marketplace_create",
            text=" ".join([title, description, location]).strip(),
        )
        decision = precheck_text_or_raise(
            text=" ".join([title, description, location]).strip(),
            actor=self.request.user,
            context="marketplace_create",
        )
        listing = serializer.save(seller=self.request.user)
        record_text_classification(
            content_object=listing,
            actor=self.request.user,
            decision=decision,
            metadata={"context": "marketplace_create"},
        )

    def perform_update(self, serializer):
        listing = self.get_object()
        if listing.seller != self.request.user:
            raise PermissionDenied("You can only edit your own listings.")
        title = serializer.validated_data.get("title")
        description = serializer.validated_data.get("description")
        location = serializer.validated_data.get("location")
        decision = None
        if any(value is not None for value in (title, description, location)):
            decision = precheck_text_or_raise(
                text=" ".join([title or listing.title, description or listing.description, location or listing.location]).strip(),
                actor=self.request.user,
                context="marketplace_update",
            )
        listing = serializer.save()
        if decision:
            record_text_classification(
                content_object=listing,
                actor=self.request.user,
                decision=decision,
                metadata={"context": "marketplace_update"},
            )

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

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def sold_items(self, request):
        """Get sold items by current user with accepted offer details."""
        user = request.user

        # Get sold listings with their accepted offers
        sold_listings = MarketplaceListing.objects.filter(
            seller=user, status="sold"
        ).prefetch_related("offers")

        result = []
        for listing in sold_listings:
            # Find the accepted offer
            accepted_offer = listing.offers.filter(status="accepted").first()
            if accepted_offer:
                result.append(
                    {
                        "listing": MarketplaceListingSerializer(
                            listing, context={"request": request}
                        ).data,
                        "offer": MarketplaceOfferSerializer(
                            accepted_offer, context={"request": request}
                        ).data,
                        "sold_price": str(accepted_offer.offered_price),
                        "sold_to": {
                            "id": accepted_offer.buyer.id,
                            "username": accepted_offer.buyer.username,
                            "first_name": accepted_offer.buyer.first_name,
                            "last_name": accepted_offer.buyer.last_name,
                            "profile_image_url": accepted_offer.buyer.profile_image_url,
                        },
                        "sold_date": listing.sold_at,
                    }
                )

        return Response(result)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def cancelled_listings(self, request):
        """Get cancelled listings by current user."""
        user = request.user

        # Get cancelled listings
        cancelled_listings = MarketplaceListing.objects.filter(
            seller=user, status="cancelled"
        ).order_by("-updated_at")

        serializer = self.get_serializer(cancelled_listings, many=True)
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
        try:
            listing = serializer.validated_data["listing"]

            # Check if user already made an offer
            existing = MarketplaceOffer.objects.filter(
                listing=listing, buyer=self.request.user
            ).first()

            if existing:
                raise ValidationError("You already made an offer on this listing.")

            offer = serializer.save(buyer=self.request.user)

            # Create notification for seller
            try:
                from .models import Notification
                from django.contrib.contenttypes.models import ContentType
                
                offer_content_type = ContentType.objects.get_for_model(MarketplaceOffer)
                Notification.objects.create(
                    recipient=listing.seller,
                    actor=self.request.user,
                    verb="marketplace_offer_received",
                    content_type=offer_content_type,
                    object_id=offer.id,
                )
            except Exception as e:
                logger.error(f"Failed to create offer notification: {e}")

            # Send email to seller about the new offer
            try:
                send_offer_received_email(offer)
            except Exception as e:
                # Log the error but don't fail the request
                print(f"Failed to send offer received email: {e}")
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in perform_create for offer: {e}", exc_info=True)
            raise

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

        # Create notification for buyer
        try:
            from .models import Notification
            from django.contrib.contenttypes.models import ContentType
            
            offer_content_type = ContentType.objects.get_for_model(MarketplaceOffer)
            Notification.objects.create(
                recipient=offer.buyer,
                actor=request.user,
                verb="marketplace_offer_accepted",
                content_type=offer_content_type,
                object_id=offer.id,
            )
        except Exception as e:
            logger.error(f"Failed to create offer accepted notification: {e}")

        # Send email to buyer about the acceptance
        try:
            send_offer_accepted_email(offer)
        except Exception as e:
            # Log the error but don't fail the request
            print(f"Failed to send offer accepted email: {e}")

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

        # Create notification for buyer
        try:
            from .models import Notification
            from django.contrib.contenttypes.models import ContentType
            
            offer_content_type = ContentType.objects.get_for_model(MarketplaceOffer)
            Notification.objects.create(
                recipient=offer.buyer,
                actor=request.user,
                verb="marketplace_offer_declined",
                content_type=offer_content_type,
                object_id=offer.id,
            )
        except Exception as e:
            logger.error(f"Failed to create offer declined notification: {e}")

        # Send email to buyer about the decline
        try:
            send_offer_declined_email(offer)
        except Exception as e:
            # Log the error but don't fail the request
            print(f"Failed to send offer declined email: {e}")

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
        # The serializer usually maps 'listing_id' -> 'listing' (source="listing").
        # But to be defensive (and handle callers using slightly different
        # payloads), try to read the listing from validated_data first and
        # fall back to parsing the request payload.
        listing = serializer.validated_data.get("listing")
        if not listing:
            listing_id = self.request.data.get("listing_id") or self.request.data.get(
                "listing"
            )
            if not listing_id:
                raise ValidationError({"listing_id": ["This field is required."]})
            # Import here to avoid circular imports at module load
            from .marketplace_models import MarketplaceListing

            try:
                listing = MarketplaceListing.objects.get(pk=listing_id)
            except MarketplaceListing.DoesNotExist:
                raise ValidationError({"listing_id": ["Invalid listing id."]})

        if listing.seller != self.request.user:
            raise PermissionDenied("You can only add media to your own listings.")

        # Ensure the serializer saves with the listing object (in case it was
        # obtained from request.data rather than validated_data)
        serializer.save(listing=listing)

    def perform_destroy(self, instance):
        if instance.listing.seller != self.request.user:
            raise PermissionDenied("You can only delete media from your own listings.")
        instance.delete()
