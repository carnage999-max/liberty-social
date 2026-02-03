from typing import Iterable, List, Optional

from django.contrib.contenttypes.models import ContentType
from django.db.models import Q, QuerySet

from ..moderation_models import ContentClassification, UserFilterPreference, UserFilterProfile
from ..models import Post


def get_active_filter_profile(user) -> Optional[UserFilterProfile]:
    preference = (
        UserFilterPreference.objects.select_related("active_profile")
        .filter(user=user)
        .first()
    )
    if preference and preference.active_profile:
        return preference.active_profile
    return (
        UserFilterProfile.objects.filter(user=user, is_default=True)
        .order_by("-updated_at")
        .first()
    )


def _hidden_labels(profile: UserFilterProfile) -> List[str]:
    toggles = profile.category_toggles or {}
    hidden = [label for label, enabled in toggles.items() if enabled is False]
    if profile.allow_explicit_content:
        hidden = [
            label
            for label in hidden
            if label.lower() != "explicit adult content".lower()
        ]
    return hidden


def apply_user_filters_to_posts(qs: QuerySet, user) -> QuerySet:
    profile = get_active_filter_profile(user)
    if not profile:
        return qs

    hidden_labels = _hidden_labels(profile)
    keyword_mutes = profile.keyword_mutes or []
    account_mutes = profile.account_mutes or []

    if account_mutes:
        qs = qs.exclude(author__id__in=account_mutes)

    for keyword in keyword_mutes:
        keyword = str(keyword).strip()
        if keyword:
            qs = qs.exclude(content__icontains=keyword)

    if hidden_labels:
        ct = ContentType.objects.get_for_model(Post)
        hidden_ids: List[str] = []
        for label in hidden_labels:
            hidden_ids.extend(
                ContentClassification.objects.filter(
                    content_type=ct, labels__contains=[label]
                ).values_list("object_id", flat=True)
            )
        if hidden_ids:
            qs = qs.exclude(id__in=hidden_ids)

    return qs
