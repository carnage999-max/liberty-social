import json
import logging
from typing import Optional, List

from celery import shared_task
from django.conf import settings
from exponent_server_sdk import PushClient, PushMessage, PushTicketError

from .models import Notification

logger = logging.getLogger(__name__)

# Initialize Expo Push Client
_push_client: Optional[PushClient] = None


def _get_push_client() -> Optional[PushClient]:
    """Get or create Expo Push Client instance."""
    global _push_client
    if _push_client is None:
        _push_client = PushClient()
    return _push_client


def _is_expo_token(token: str) -> bool:
    """Check if token is an Expo push token (starts with ExponentPushToken or ExpoPushToken)."""
    return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    max_retries=5,
)
def deliver_push_notification(self, notification_id: int):
    """Send a push notification via Expo Push Notification Service for a newly created Notification."""
    if not getattr(settings, "PUSH_NOTIFICATIONS_ENABLED", False):
        return

    try:
        notification = (
            Notification.objects.select_related("recipient", "actor")
            .get(pk=notification_id)
        )
    except Notification.DoesNotExist:
        return

    recipient = notification.recipient
    # Get tokens with platform info
    device_tokens = list(
        recipient.device_tokens.values_list("token", "platform", flat=False)
    )
    if not device_tokens:
        logger.info(
            "No device tokens found for user %s (notification %s)",
            recipient.id,
            notification_id,
        )
        return

    # Filter to only Expo tokens (for mobile apps)
    # Web tokens (FCM) can be handled separately if needed
    expo_tokens = [
        (token, platform)
        for token, platform in device_tokens
        if _is_expo_token(token) and platform in ("ios", "android")
    ]

    if not expo_tokens:
        logger.info(
            "No Expo push tokens found for user %s (notification %s). "
            "Web tokens are not supported via Expo Push Service.",
            recipient.id,
            notification_id,
        )
        return

    logger.info(
        "Sending push notification %s to user %s with %d Expo token(s)",
        notification_id,
        recipient.id,
        len(expo_tokens),
    )

    actor = notification.actor
    actor_label = actor.get_full_name() or actor.username or actor.email or "Someone"
    verb = notification.verb

    from .serializers import NotificationSerializer  # local import to avoid cycles

    payload = NotificationSerializer(notification).data

    message_title = "Liberty Social"
    message_body = f"{actor_label} {verb}"

    # Build notification data
    notification_data = {
        "notification": payload,
        "target_url": payload.get("target_url", "/app/notifications"),
    }

    # Create push messages for all Expo tokens
    push_client = _get_push_client()
    if not push_client:
        logger.error("Failed to initialize Expo Push Client")
        return

    messages: List[PushMessage] = []
    token_to_platform = {}

    for token, platform in expo_tokens:
        # Extract clean token (remove brackets if present)
        clean_token = token
        if token.startswith("ExponentPushToken["):
            clean_token = token[len("ExponentPushToken[") : -1]
        elif token.startswith("ExpoPushToken["):
            clean_token = token[len("ExpoPushToken[") : -1]

        token_to_platform[clean_token] = platform

        # Create push message
        message = PushMessage(
            to=clean_token,
            title=message_title,
            body=message_body,
            data=notification_data,
            sound="default",
            priority="high",
            channel_id="default" if platform == "android" else None,
        )
        messages.append(message)

    if not messages:
        return

    # Send notifications
    try:
        chunks = push_client.send_push_notifications(messages)
        invalid_tokens = []

        for chunk in chunks:
            for ticket in chunk:
                if isinstance(ticket, PushTicketError):
                    error = ticket
                    token = ticket.push_token

                    # Check if token is invalid and should be removed
                    # Expo SDK uses error codes: DeviceNotRegistered, InvalidCredentials, MessageTooBig, MessageRateExceeded
                    if error.code in ("DeviceNotRegistered", "InvalidCredentials"):
                        logger.warning(
                            "Invalid Expo token detected for notification %s (platform: %s): %s - %s",
                            notification_id,
                            token_to_platform.get(token, "unknown"),
                            error.code,
                            error.message,
                        )
                        # Find and mark token for deletion
                        for device_token, platform in expo_tokens:
                            clean_token = device_token
                            if device_token.startswith("ExponentPushToken["):
                                clean_token = device_token[len("ExponentPushToken[") : -1]
                            elif device_token.startswith("ExpoPushToken["):
                                clean_token = device_token[len("ExpoPushToken[") : -1]
                            if clean_token == token:
                                invalid_tokens.append(device_token)
                                break
                    else:
                        logger.error(
                            "Failed to deliver push notification %s to token %s (platform: %s): %s - %s",
                            notification_id,
                            token[:20] + "..." if token else "unknown",
                            token_to_platform.get(token, "unknown"),
                            error.code if hasattr(error, 'code') else "Unknown",
                            error.message if hasattr(error, 'message') else str(error),
                        )
                else:
                    logger.info(
                        "Successfully delivered push notification %s to token %s (platform: %s)",
                        notification_id,
                        ticket.push_token[:20] + "..." if ticket.push_token else "unknown",
                        token_to_platform.get(ticket.push_token, "unknown"),
                    )

        # Remove invalid tokens
        if invalid_tokens:
            recipient.device_tokens.filter(token__in=invalid_tokens).delete()
            logger.info(
                "Removed %d invalid device token(s) for user %s",
                len(invalid_tokens),
                recipient.id,
            )

    except Exception as exc:
        logger.exception(
            "Error sending push notifications via Expo Push Service for notification %s",
            notification_id,
        )
        raise self.retry(exc=exc)
