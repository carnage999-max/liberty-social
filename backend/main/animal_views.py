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
from django.contrib.contenttypes.models import ContentType
from .models import Notification
from .emails import send_templated_email

from .animal_models import (
    AnimalCategory,
    AnimalSellerVerification,
    VetDocumentation,
    AnimalListing,
    AnimalListingMedia,
    SellerReview,
    SuspiciousActivityLog,
    BreederDirectory,
    AdminActionLog,
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
    AdminActionLogSerializer,
)
from .slug_utils import SlugOrIdLookupMixin
from .moderation.pipeline import precheck_text_or_raise, record_text_classification
from .moderation.throttling import enforce_throttle
from .emails import send_templated_email
from django.core.mail import send_mail


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

    @action(detail=False, methods=["post"])
    def submit_verification(self, request):
        """
        Submit KYC verification for review.
        Required fields: full_name, phone_number, address, city, state_code, zip_code
        Optional: id_document_url, breeder_license_number, breeder_license_url
        """
        try:
            verification, created = AnimalSellerVerification.objects.get_or_create(
                user=request.user
            )
            
            # Validate required fields
            required_fields = [
                "full_name", "phone_number", "address", "city", "state_code", "zip_code"
            ]
            missing = [f for f in required_fields if not request.data.get(f)]
            
            if missing:
                return Response(
                    {"error": f"Missing required fields: {', '.join(missing)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update verification with request data
            serializer = self.get_serializer(verification, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            
            # Set status to pending for manual review
            if verification.status == "pending" or created:
                verification.status = "pending"
                verification.save()
            
            return Response({
                "message": "Verification submitted for review",
                "status": verification.status,
                "verification": serializer.data
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=["get"])
    def check_eligibility(self, request):
        """Check if user is eligible to list animals."""
        try:
            verification = AnimalSellerVerification.objects.get(user=request.user)
            is_verified = verification.is_verified
            status_value = verification.status
        except AnimalSellerVerification.DoesNotExist:
            is_verified = False
            status_value = "not_submitted"
        
        return Response({
            "user_id": request.user.id,
            "is_verified": is_verified,
            "verification_status": status_value,
            "can_list": is_verified,  # Can list without verification but will be marked unverified
            "message": "You can list animals but unverified listings get lower visibility. Complete KYC to get verified badge." if not is_verified else "Your account is verified!"
        })

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAdminUser])
    def approve(self, request, pk=None):
        """Approve a seller verification (admin only)."""
        verification = get_object_or_404(AnimalSellerVerification, pk=pk)
        if verification.status == "verified":
            return Response({"message": "Already verified."}, status=status.HTTP_200_OK)

        verification.status = "verified"
        verification.verified_at = timezone.now()
        verification.verified_by = request.user
        # default expiration: 1 year
        verification.expires_at = timezone.now() + timedelta(days=365)
        verification.rejection_reason = ""
        verification.save()

        # Audit log the approval
        try:
            AdminActionLog.objects.create(
                action_type="approve_kyc",
                target_type="AnimalSellerVerification",
                target_id=str(verification.pk),
                performed_by=request.user,
                notes=f"Approved verification for user_id={verification.user_id}",
            )
        except Exception:
            import logging

            logging.exception("Failed to create AdminActionLog for KYC approval")

        # Send templated email to the user (best-effort)
        try:
            if verification.user and verification.user.email:
                ctx = {
                    "user": verification.user,
                    "full_name": verification.full_name,
                    "verification": verification,
                    "support_url": getattr(__import__("django.conf").conf.settings, "FRONTEND_URL", ""),
                }
                send_templated_email(
                    "kyc_approved",
                    ctx,
                    "Your account verification has been approved",
                    verification.user.email,
                )

                # Create in-app notification (this will also broadcast via channels)
                try:
                    ct = ContentType.objects.get_for_model(AnimalSellerVerification)
                    Notification.objects.create(
                        recipient=verification.user,
                        actor=request.user,
                        verb="kyc_approved",
                        content_type=ct,
                        object_id=verification.pk,
                    )
                except Exception:
                    import logging

                    logging.exception("Failed to create in-app notification for KYC approval")
        except Exception:
            import logging

            logging.exception("Failed to send templated KYC approval email")

        return Response({"message": "Verification approved.", "status": verification.status})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAdminUser])
    def reject(self, request, pk=None):
        """Reject a seller verification with optional reason (admin only)."""
        verification = get_object_or_404(AnimalSellerVerification, pk=pk)
        reason = request.data.get("reason", "")
        verification.status = "rejected"
        verification.rejection_reason = reason
        verification.verified_at = None
        verification.verified_by = None
        verification.expires_at = None
        verification.save()

        # Audit log the rejection
        try:
            AdminActionLog.objects.create(
                action_type="reject_kyc",
                target_type="AnimalSellerVerification",
                target_id=str(verification.pk),
                performed_by=request.user,
                notes=f"Rejected verification for user_id={verification.user_id}; reason={reason}",
            )
        except Exception:
            import logging

            logging.exception("Failed to create AdminActionLog for KYC rejection")

        # Send templated email to the user (best-effort)
        try:
            if verification.user and verification.user.email:
                ctx = {
                    "user": verification.user,
                    "full_name": verification.full_name,
                    "verification": verification,
                    "reason": reason,
                    "support_url": getattr(__import__("django.conf").conf.settings, "FRONTEND_URL", ""),
                }
                send_templated_email(
                    "kyc_rejected",
                    ctx,
                    "Your account verification has been rejected",
                    verification.user.email,
                )

                # Create in-app notification
                try:
                    ct = ContentType.objects.get_for_model(AnimalSellerVerification)
                    Notification.objects.create(
                        recipient=verification.user,
                        actor=request.user,
                        verb="kyc_rejected",
                        content_type=ct,
                        object_id=verification.pk,
                    )
                except Exception:
                    import logging

                    logging.exception("Failed to create in-app notification for KYC rejection")
        except Exception:
            import logging

            logging.exception("Failed to send templated KYC rejection email")

        return Response({"message": "Verification rejected.", "status": verification.status, "reason": reason})


class AnimalListingViewSet(SlugOrIdLookupMixin, viewsets.ModelViewSet):
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

        queryset = queryset.order_by("-created_at")

        # Filter by risk score (requires post-filtering since it's calculated)
        risk_score_min = self.request.query_params.get("risk_score_min")
        risk_score_max = self.request.query_params.get("risk_score_max")
        if risk_score_min is not None or risk_score_max is not None:
            listings = list(queryset)
            filtered_listings = []
            for listing in listings:
                risk_score = listing.get_risk_score()
                if risk_score_min is not None and risk_score < float(risk_score_min):
                    continue
                if risk_score_max is not None and risk_score > float(risk_score_max):
                    continue
                filtered_listings.append(listing.pk)
            queryset = AnimalListing.objects.filter(pk__in=filtered_listings).order_by("-created_at")

        return queryset

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
        title = serializer.validated_data.get("title") or ""
        description = serializer.validated_data.get("description") or ""
        breed = serializer.validated_data.get("breed") or ""
        location = serializer.validated_data.get("location") or ""
        enforce_throttle(
            actor=self.request.user,
            context="animal_listing_create",
            text=" ".join([title, description, breed, location]).strip(),
        )
        decision = precheck_text_or_raise(
            text=" ".join([title, description, breed, location]).strip(),
            actor=self.request.user,
            context="animal_listing_create",
        )
        listing = serializer.save(seller=self.request.user)
        record_text_classification(
            content_object=listing,
            actor=self.request.user,
            decision=decision,
            metadata={"context": "animal_listing_create"},
        )

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

        title = serializer.validated_data.get("title")
        description = serializer.validated_data.get("description")
        breed = serializer.validated_data.get("breed")
        location = serializer.validated_data.get("location")
        decision = None
        if any(value is not None for value in (title, description, breed, location)):
            decision = precheck_text_or_raise(
                text=" ".join(
                    [
                        title or instance.title,
                        description or instance.description,
                        breed or instance.breed,
                        location or instance.location,
                    ]
                ).strip(),
                actor=self.request.user,
                context="animal_listing_update",
            )
        listing = serializer.save()
        if decision:
            record_text_classification(
                content_object=listing,
                actor=self.request.user,
                decision=decision,
                metadata={"context": "animal_listing_update"},
            )

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
        """Create media for listing with stock photo detection."""
        from .utils.stock_photo_detector import StockPhotoDetector
        
        listing_id = self.request.data.get("listing_id")
        listing = get_object_or_404(AnimalListing, id=listing_id)

        if listing.seller != self.request.user:
            raise PermissionDenied("Cannot add media to this listing.")

        media = serializer.save(listing=listing)
        
        # Check for stock photos
        if media.url:
            is_stock, confidence = StockPhotoDetector.detect(media.url)
            media.is_stock_photo = is_stock
            media.stock_photo_confidence = confidence
            media.save()
            
            # Add to listing's scam flags if high confidence stock photo
            if is_stock and confidence > 0.7:
                if "stock_photo_detected" not in listing.scam_flags:
                    listing.scam_flags.append("stock_photo_detected")
                    listing.save()


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


class BreederDirectoryViewSet(SlugOrIdLookupMixin, viewsets.ModelViewSet):
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

    def perform_create(self, serializer):
        breeder_name = serializer.validated_data.get("breeder_name") or ""
        bio = serializer.validated_data.get("bio") or ""
        decision = precheck_text_or_raise(
            text=" ".join([breeder_name, bio]).strip(),
            actor=self.request.user,
            context="breeder_directory_create",
        )
        breeder = serializer.save()
        record_text_classification(
            content_object=breeder,
            actor=self.request.user,
            decision=decision,
            metadata={"context": "breeder_directory_create"},
        )

    def perform_update(self, serializer):
        breeder = serializer.instance
        breeder_name = serializer.validated_data.get("breeder_name")
        bio = serializer.validated_data.get("bio")
        decision = None
        if breeder_name is not None or bio is not None:
            decision = precheck_text_or_raise(
                text=" ".join([breeder_name or breeder.breeder_name, bio or breeder.bio]).strip(),
                actor=self.request.user,
                context="breeder_directory_update",
            )
        breeder = serializer.save()
        if decision:
            record_text_classification(
                content_object=breeder,
                actor=self.request.user,
                decision=decision,
                metadata={"context": "breeder_directory_update"},
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


class AdminActionLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for admin audit logs."""

    serializer_class = AdminActionLogSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return AdminActionLog.objects.select_related("performed_by").all().order_by(
            "-created_at"
        )
