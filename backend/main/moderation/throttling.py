import hashlib
from typing import Any, Dict, Optional

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import Throttled

from ..moderation_models import ModerationAction


DEFAULT_THROTTLE_LIMITS: Dict[str, Dict[str, int]] = {
    "post_create": {"limit": 6, "window": 60},
    "comment_create": {"limit": 20, "window": 60},
    "message_create": {"limit": 30, "window": 60},
    "marketplace_create": {"limit": 5, "window": 3600},
    "animal_listing_create": {"limit": 5, "window": 3600},
    "yard_sale_create": {"limit": 3, "window": 86400},
    "page_create": {"limit": 2, "window": 86400},
}

DEFAULT_DUPLICATE_LIMITS: Dict[str, Dict[str, int]] = {
    "post_create": {"limit": 3, "window": 300},
    "comment_create": {"limit": 5, "window": 300},
    "message_create": {"limit": 5, "window": 300},
}


def _get_limits(context: str) -> Dict[str, int]:
    overrides = getattr(settings, "MODERATION_THROTTLE_LIMITS", {})
    if isinstance(overrides, dict) and context in overrides:
        return overrides[context]
    return DEFAULT_THROTTLE_LIMITS.get(context, {"limit": 10, "window": 60})


def _get_duplicate_limits(context: str) -> Dict[str, int]:
    overrides = getattr(settings, "MODERATION_DUPLICATE_LIMITS", {})
    if isinstance(overrides, dict) and context in overrides:
        return overrides[context]
    return DEFAULT_DUPLICATE_LIMITS.get(context, {"limit": 4, "window": 300})


def _cache_incr(key: str, window: int) -> int:
    try:
        count = cache.incr(key)
        return int(count)
    except ValueError:
        cache.set(key, 1, timeout=window)
        return 1


def _log_throttle(actor, context: str, reason_code: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    ModerationAction.objects.create(
        layer="L3",
        action="throttle",
        reason_code=reason_code,
        rule_ref=f"L3:{reason_code}",
        actor=actor,
        metadata={"context": context, **(metadata or {})},
    )


def enforce_throttle(*, actor, context: str, text: Optional[str] = None) -> None:
    if not actor or not getattr(actor, "id", None):
        return

    limits = _get_limits(context)
    limit = int(limits.get("limit", 10))
    window = int(limits.get("window", 60))

    rate_key = f"moderation:rate:{context}:{actor.id}"
    count = _cache_incr(rate_key, window)
    if count > limit:
        _log_throttle(actor, context, "rate_limit", {"count": count, "limit": limit})
        raise Throttled(detail="You are posting too quickly. Please wait and try again.")

    if text:
        cleaned = " ".join(text.split()).strip().lower()
        if len(cleaned) >= 20:
            dup_limits = _get_duplicate_limits(context)
            dup_limit = int(dup_limits.get("limit", 4))
            dup_window = int(dup_limits.get("window", 300))
            digest = hashlib.sha256(cleaned.encode("utf-8")).hexdigest()[:16]
            dup_key = f"moderation:dup:{context}:{actor.id}:{digest}"
            dup_count = _cache_incr(dup_key, dup_window)
            if dup_count > dup_limit:
                _log_throttle(
                    actor,
                    context,
                    "duplicate_content",
                    {"count": dup_count, "limit": dup_limit},
                )
                raise Throttled(
                    detail="Duplicate content detected. Please vary your message."
                )
