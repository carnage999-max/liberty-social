"""
Yard Sale API Views
Map-based discovery, radius search, and listing management
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Q
from math import radians, sin, cos, sqrt, atan2
from decimal import Decimal
import logging
import stripe
from django.conf import settings

from main.models import YardSaleListing, YardSaleReport
from main.serializers import YardSaleListingSerializer, YardSaleReportSerializer

logger = logging.getLogger(__name__)

# Earth's radius in miles
EARTH_RADIUS_MILES = 3959


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two geographic points in miles using Haversine formula.
    """
    lat1, lon1, lat2, lon2 = map(
        radians, [float(lat1), float(lon1), float(lat2), float(lon2)]
    )

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return EARTH_RADIUS_MILES * c


@api_view(["GET"])
@permission_classes([AllowAny])
def yard_sales_search(request):
    """
    Search yard sales by radius and geographic location.

    Query Parameters:
    - latitude: user's latitude (required)
    - longitude: user's longitude (required)
    - radius: search radius in miles (default: 25, max: 100)
    - start_date: filter by start date (optional)
    - end_date: filter by end date (optional)
    """

    try:
        lat = Decimal(request.query_params.get("latitude"))
        lon = Decimal(request.query_params.get("longitude"))
        radius = int(request.query_params.get("radius", 25))

        # Validate inputs
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return Response(
                {"error": "Invalid latitude or longitude"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if radius < 1 or radius > 100:
            return Response(
                {"error": "Radius must be between 1 and 100 miles"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    except (TypeError, ValueError) as e:
        return Response(
            {"error": f"Invalid parameters: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get active yard sales
    today = timezone.now().date()
    listings = YardSaleListing.objects.filter(
        status="active", end_date__gte=today
    ).select_related("user")

    # Filter by distance using haversine
    nearby_listings = []
    for listing in listings:
        distance = haversine_distance(lat, lon, listing.latitude, listing.longitude)
        if distance <= radius:
            nearby_listings.append({"listing": listing, "distance": round(distance, 2)})

    # Sort by distance
    nearby_listings.sort(key=lambda x: x["distance"])

    # Format response
    results = [
        {
            **YardSaleListingSerializer(item["listing"]).data,
            "distance_miles": item["distance"],
        }
        for item in nearby_listings
    ]

    return Response(
        {
            "count": len(results),
            "search_center": {
                "latitude": float(lat),
                "longitude": float(lon),
                "radius_miles": radius,
            },
            "results": results,
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def yard_sale_detail(request, listing_id):
    """
    Get detailed information about a specific yard sale listing.
    """
    try:
        listing = YardSaleListing.objects.get(id=listing_id)
    except YardSaleListing.DoesNotExist:
        return Response(
            {"error": "Listing not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Increment view count
    listing.view_count += 1
    listing.save(update_fields=["view_count"])

    return Response(YardSaleListingSerializer(listing).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_yard_sale(request):
    """
    Create a new yard sale listing.
    Requires payment of $0.99.
    """

    serializer = YardSaleListingSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # TODO: Integrate payment processing
    # For now, create listing directly (payment integration in next step)
    listing = serializer.save(user=request.user)

    return Response(
        YardSaleListingSerializer(listing).data, status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_yard_sale_payment_intent(request):
    """
    Create a Stripe PaymentIntent for $0.99 to reserve a yard sale listing.
    Returns client_secret and intent id for client-side checkout.
    """
    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        amount_cents = 99
        # Allow attaching optional metadata from client (e.g., title) under 'metadata'
        metadata = {
            "user_id": str(request.user.id),
            "email": request.user.email or "",
            "purpose": "yard_sale_listing",
            **(request.data.get("metadata") or {}),
        }

        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            metadata=metadata,
            automatic_payment_methods={"enabled": True},
        )

        return Response({"client_secret": intent.client_secret, "intent_id": intent.id})
    except Exception as e:
        logger.exception("Stripe PaymentIntent creation failed")
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_yard_sale_payment(request):
    """
    Confirm a Stripe PaymentIntent and create the yard sale listing.
    Expects JSON body: { payment_intent_id: str, payload: { ...listing fields... } }
    """
    stripe.api_key = settings.STRIPE_SECRET_KEY
    payment_intent_id = request.data.get("payment_intent_id")
    payload = request.data.get("payload") or {}

    if not payment_intent_id:
        return Response({"error": "payment_intent_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)

        # Check that the payment succeeded
        if intent.status != "succeeded":
            return Response({"error": "Payment not completed"}, status=status.HTTP_400_BAD_REQUEST)

        # Create listing using payload, ensuring authenticated user
        serializer = YardSaleListingSerializer(data=payload)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        listing = serializer.save(user=request.user)

        # Optionally attach stripe metadata to listing
        listing.stripe_payment_intent = payment_intent_id
        listing.save(update_fields=["stripe_payment_intent"]) if hasattr(listing, 'stripe_payment_intent') else None

        return Response(YardSaleListingSerializer(listing).data, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.exception("Error confirming payment and creating listing")
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """
    Basic Stripe webhook endpoint. Validates signature when STRIPE_WEBHOOK_SECRET is configured.

    - On payment_intent.succeeded: if metadata.purpose == 'yard_sale_listing' and metadata.payload exists,
      attempts to create the yard sale listing on behalf of the user_id in metadata.
    """
    stripe.api_key = settings.STRIPE_SECRET_KEY
    payload_body = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")

    try:
        if settings.STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload_body, sig_header, settings.STRIPE_WEBHOOK_SECRET)
        else:
            # In development without webhook secret, parse JSON directly (not verified)
            import json

            event = json.loads(payload_body)
    except Exception as e:
        logger.exception("Stripe webhook signature verification failed")
        return Response({"error": "Invalid webhook payload"}, status=status.HTTP_400_BAD_REQUEST)

    event_type = event.get("type") if isinstance(event, dict) else getattr(event, "type", None)
    data_obj = None
    if isinstance(event, dict):
        data_obj = event.get("data", {}).get("object")
    else:
        data_obj = event.data.object

    try:
        if event_type == "payment_intent.succeeded":
            metadata = data_obj.get("metadata", {}) if isinstance(data_obj, dict) else getattr(data_obj, "metadata", {})
            if metadata.get("purpose") == "yard_sale_listing" and metadata.get("payload"):
                import json
                from django.contrib.auth import get_user_model

                payload_json = json.loads(metadata.get("payload"))
                user_id = metadata.get("user_id")
                User = get_user_model()
                user = None
                if user_id:
                    try:
                        user = User.objects.get(id=int(user_id))
                    except User.DoesNotExist:
                        user = None

                # Create listing (best-effort)
                serializer = YardSaleListingSerializer(data=payload_json)
                if serializer.is_valid():
                    listing = serializer.save(user=user if user else None)
                    if hasattr(listing, "stripe_payment_intent"):
                        listing.stripe_payment_intent = data_obj.get("id") if isinstance(data_obj, dict) else getattr(data_obj, "id", None)
                        listing.save(update_fields=["stripe_payment_intent"])

        # Return success
        return Response({"status": "ok"})
    except Exception as e:
        logger.exception("Error processing stripe webhook")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_yard_sale(request, listing_id):
    """
    Update a yard sale listing (seller only).
    """

    try:
        listing = YardSaleListing.objects.get(id=listing_id)
    except YardSaleListing.DoesNotExist:
        return Response(
            {"error": "Listing not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Check ownership
    if listing.user != request.user:
        return Response(
            {"error": "You do not have permission to edit this listing"},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = YardSaleListingSerializer(listing, data=request.data, partial=True)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    listing = serializer.save()
    return Response(YardSaleListingSerializer(listing).data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_yard_sale(request, listing_id):
    """
    Delete/archive a yard sale listing (seller only).
    """

    try:
        listing = YardSaleListing.objects.get(id=listing_id)
    except YardSaleListing.DoesNotExist:
        return Response(
            {"error": "Listing not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Check ownership
    if listing.user != request.user:
        return Response(
            {"error": "You do not have permission to delete this listing"},
            status=status.HTTP_403_FORBIDDEN,
        )

    listing.status = "archived"
    listing.save()

    return Response({"message": "Listing archived successfully"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_yard_sales(request):
    """
    Get all yard sale listings created by the authenticated user.
    """

    listings = YardSaleListing.objects.filter(user=request.user).order_by("-created_at")
    serializer = YardSaleListingSerializer(listings, many=True)

    return Response({"count": len(listings), "results": serializer.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_yard_sale(request, listing_id):
    """
    Report a yard sale listing for moderation.
    """

    try:
        listing = YardSaleListing.objects.get(id=listing_id)
    except YardSaleListing.DoesNotExist:
        return Response(
            {"error": "Listing not found"}, status=status.HTTP_404_NOT_FOUND
        )

    serializer = YardSaleReportSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    report = serializer.save(listing=listing, reported_by=request.user)

    return Response(
        YardSaleReportSerializer(report).data, status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def contact_seller(request, listing_id):
    """
    Track contact intent (for analytics).
    Increments contact_count on listing.
    """

    try:
        listing = YardSaleListing.objects.get(id=listing_id)
    except YardSaleListing.DoesNotExist:
        return Response(
            {"error": "Listing not found"}, status=status.HTTP_404_NOT_FOUND
        )

    listing.contact_count += 1
    listing.save(update_fields=["contact_count"])

    return Response(
        {
            "message": "Contact intent recorded",
            "phone": listing.phone if listing.phone else "Not provided",
            "listing_title": listing.title,
        }
    )
