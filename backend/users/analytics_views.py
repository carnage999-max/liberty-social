from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.db.models import Count, Q, F
from django.utils import timezone
from datetime import timedelta
from users.models import User


@api_view(["GET"])
@permission_classes([IsAdminUser])
def analytics_overview(request):
    """Get overall analytics overview"""

    # Total users
    total_users = User.objects.count()
    active_users = User.objects.filter(is_online=True).count()

    # Gender breakdown
    gender_stats = (
        User.objects.values("gender").annotate(count=Count("id")).order_by("-count")
    )

    # Age statistics
    age_stats = (
        User.objects.filter(age__isnull=False)
        .values("age")
        .annotate(count=Count("id"))
        .order_by("age")
    )

    return Response(
        {
            "total_users": total_users,
            "active_users": active_users,
            "gender_stats": list(gender_stats),
            "age_stats": list(age_stats),
        }
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def analytics_by_country(request):
    """Get user statistics by country"""

    country_stats = (
        User.objects.filter(country__isnull=False)
        .values("country")
        .annotate(
            total=Count("id"),
            male=Count("id", filter=Q(gender="male")),
            female=Count("id", filter=Q(gender="female")),
            active=Count("id", filter=Q(is_online=True)),
        )
        .order_by("-total")
    )

    return Response(list(country_stats))


@api_view(["GET"])
@permission_classes([IsAdminUser])
def analytics_by_state(request):
    """Get user statistics by state"""

    country = request.query_params.get("country", None)

    query = User.objects.filter(state__isnull=False)
    if country:
        query = query.filter(country=country)

    state_stats = (
        query.values("state", "country")
        .annotate(
            total=Count("id"),
            male=Count("id", filter=Q(gender="male")),
            female=Count("id", filter=Q(gender="female")),
            active=Count("id", filter=Q(is_online=True)),
        )
        .order_by("-total")
    )

    return Response(list(state_stats))


@api_view(["GET"])
@permission_classes([IsAdminUser])
def analytics_by_age(request):
    """Get user statistics by age group"""

    gender = request.query_params.get("gender", None)
    country = request.query_params.get("country", None)

    query = User.objects.filter(age__isnull=False)

    if gender and gender != "all":
        query = query.filter(gender=gender)
    if country:
        query = query.filter(country=country)

    age_stats = (
        query.values("age")
        .annotate(
            total=Count("id"),
            male=Count("id", filter=Q(gender="male")),
            female=Count("id", filter=Q(gender="female")),
            active=Count("id", filter=Q(is_online=True)),
        )
        .order_by("age")
    )

    return Response(list(age_stats))


@api_view(["GET"])
@permission_classes([IsAdminUser])
def analytics_by_gender(request):
    """Get user statistics by gender"""

    country = request.query_params.get("country", None)
    age_min = request.query_params.get("age_min", None)
    age_max = request.query_params.get("age_max", None)

    query = User.objects.all()

    if country:
        query = query.filter(country=country)
    if age_min:
        query = query.filter(age__gte=int(age_min))
    if age_max:
        query = query.filter(age__lte=int(age_max))

    gender_stats = (
        query.values("gender")
        .annotate(total=Count("id"), active=Count("id", filter=Q(is_online=True)))
        .order_by("-total")
    )

    return Response(list(gender_stats))


@api_view(["GET"])
@permission_classes([IsAdminUser])
def analytics_micro_segmentation(request):
    """
    Get micro-segmented user data based on multiple filters.

    Query parameters:
    - gender: 'male', 'female', or omit for all
    - country: country name
    - state: state/province name
    - age_min: minimum age
    - age_max: maximum age
    - active_only: 'true' for active users only
    """

    query = User.objects.all()

    # Apply filters
    gender = request.query_params.get("gender", None)
    country = request.query_params.get("country", None)
    state = request.query_params.get("state", None)
    age_min = request.query_params.get("age_min", None)
    age_max = request.query_params.get("age_max", None)
    active_only = request.query_params.get("active_only", "false").lower() == "true"

    if gender and gender != "all":
        query = query.filter(gender=gender)
    if country:
        query = query.filter(country=country)
    if state:
        query = query.filter(state=state)
    if age_min:
        query = query.filter(age__gte=int(age_min))
    if age_max:
        query = query.filter(age__lte=int(age_max))
    if active_only:
        query = query.filter(is_online=True)

    # Get counts and stats
    total_count = query.count()
    male_count = query.filter(gender="male").count()
    female_count = query.filter(gender="female").count()
    active_count = query.filter(is_online=True).count()

    # Age average
    age_data = query.filter(age__isnull=False)
    avg_age = (
        age_data.aggregate(avg=models.Avg("age"))["avg"] if age_data.exists() else None
    )

    # Get breakdown by gender and age
    gender_breakdown = (
        query.values("gender").annotate(count=Count("id")).order_by("-count")
    )
    age_breakdown = (
        query.filter(age__isnull=False)
        .values("age")
        .annotate(count=Count("id"))
        .order_by("age")
    )

    return Response(
        {
            "filters": {
                "gender": gender,
                "country": country,
                "state": state,
                "age_min": age_min,
                "age_max": age_max,
                "active_only": active_only,
            },
            "summary": {
                "total": total_count,
                "male": male_count,
                "female": female_count,
                "active": active_count,
                "average_age": avg_age,
            },
            "breakdown": {
                "by_gender": list(gender_breakdown),
                "by_age": list(age_breakdown),
            },
        }
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def analytics_top_countries(request):
    """Get top 10 countries by user count"""

    limit = int(request.query_params.get("limit", 10))

    countries = (
        User.objects.filter(country__isnull=False)
        .values("country")
        .annotate(
            total=Count("id"),
            male=Count("id", filter=Q(gender="male")),
            female=Count("id", filter=Q(gender="female")),
            active=Count("id", filter=Q(is_online=True)),
        )
        .order_by("-total")[:limit]
    )

    return Response(list(countries))
