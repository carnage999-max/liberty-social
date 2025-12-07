import json
import logging
from typing import Optional, List, Tuple

from celery import shared_task
from django.conf import settings
from exponent_server_sdk import PushClient, PushMessage, PushTicketError

from .models import Notification

logger = logging.getLogger(__name__)

# Initialize Expo Push Client
_push_client: Optional[PushClient] = None
_firebase_app: Optional[object] = None


def _get_push_client() -> Optional[PushClient]:
    """Get or create Expo Push Client instance."""
    global _push_client
    if _push_client is None:
        _push_client = PushClient()
    return _push_client


def _get_firebase_app():
    """Get or create Firebase Admin app instance."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    
    # Check if Firebase is configured
    firebase_project_id = getattr(settings, "FIREBASE_PROJECT_ID", "")
    firebase_credentials_json = getattr(settings, "FIREBASE_CREDENTIALS_JSON", "")
    
    if not firebase_project_id or not firebase_credentials_json:
        logger.warning("Firebase credentials not configured. Web push notifications will not work.")
        return None
    
    try:
        import firebase_admin
        from firebase_admin import credentials
        
        # Try to get existing app
        try:
            _firebase_app = firebase_admin.get_app()
            return _firebase_app
        except ValueError:
            # App doesn't exist, create it
            pass
        
        # Parse credentials JSON
        import base64
        try:
            # Try to decode if it's base64 encoded
            credentials_json = base64.b64decode(firebase_credentials_json).decode('utf-8')
        except Exception:
            # Assume it's already a JSON string
            credentials_json = firebase_credentials_json
        
        cred = credentials.Certificate(json.loads(credentials_json))
        _firebase_app = firebase_admin.initialize_app(cred, {
            'projectId': firebase_project_id,
        })
        return _firebase_app
    except ImportError:
        logger.warning("firebase-admin not installed. Web push notifications will not work.")
        return None
    except Exception as e:
        logger.exception("Failed to initialize Firebase Admin: %s", e)
        return None


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
    """Send push notifications via Expo (mobile) and FCM (web) for a newly created Notification."""
    push_enabled = getattr(settings, "PUSH_NOTIFICATIONS_ENABLED", False)
    if not push_enabled:
        logger.debug(
            "Push notifications disabled (PUSH_NOTIFICATIONS_ENABLED=False). Skipping notification %s",
            notification_id,
        )
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

    # Separate tokens by platform
    expo_tokens: List[Tuple[str, str]] = [
        (token, platform)
        for token, platform in device_tokens
        if _is_expo_token(token) and platform in ("ios", "android")
    ]
    
    fcm_tokens: List[Tuple[str, str]] = [
        (token, platform)
        for token, platform in device_tokens
        if platform == "web" and not _is_expo_token(token)
    ]

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

    invalid_tokens = []

    # Send Expo notifications (mobile)
    if expo_tokens:
        try:
            _send_expo_notifications(
                expo_tokens, message_title, message_body, notification_data,
                notification_id, recipient, invalid_tokens
            )
        except Exception as exc:
            logger.exception(
                "Error sending Expo push notifications for notification %s",
                notification_id,
            )

    # Send FCM notifications (web)
    if fcm_tokens:
        try:
            _send_fcm_notifications(
                fcm_tokens, message_title, message_body, notification_data,
                notification_id, recipient, invalid_tokens
            )
        except Exception as exc:
            logger.exception(
                "Error sending FCM push notifications for notification %s",
                notification_id,
            )

    # Remove invalid tokens
    if invalid_tokens:
        recipient.device_tokens.filter(token__in=invalid_tokens).delete()
        logger.info(
            "Removed %d invalid device token(s) for user %s",
            len(invalid_tokens),
            recipient.id,
        )


def _send_expo_notifications(
    expo_tokens: List[Tuple[str, str]],
    message_title: str,
    message_body: str,
    notification_data: dict,
    notification_id: int,
    recipient,
    invalid_tokens: List[str],
):
    """Send push notifications via Expo Push Notification Service."""
    logger.info(
        "Sending push notification %s to user %s with %d Expo token(s)",
        notification_id,
        recipient.id,
        len(expo_tokens),
    )
    
    # Log token formats for debugging
    for token, platform in expo_tokens[:3]:  # Log first 3 tokens
        logger.debug(
            "Expo token format for platform %s: %s (length: %d)",
            platform,
            token[:30] + "..." if len(token) > 30 else token,
            len(token),
        )

    push_client = _get_push_client()
    if not push_client:
        logger.error("Failed to initialize Expo Push Client")
        return

    messages: List[PushMessage] = []
    token_to_platform = {}

    for token, platform in expo_tokens:
        # Ensure token is in the correct format (with brackets)
        # The Expo Push Service expects tokens in format: ExponentPushToken[...] or ExpoPushToken[...]
        formatted_token = token
        if not (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")):
            # If token doesn't have brackets, add them (shouldn't happen, but handle it)
            formatted_token = f"ExponentPushToken[{token}]"
        
        token_to_platform[formatted_token] = platform
        token_to_platform[token] = platform  # Also map original token for error handling

        # Create push message - send token with full format
        message = PushMessage(
            to=formatted_token,
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
    chunks = push_client.send_push_notifications(messages)

    for chunk in chunks:
        for ticket in chunk:
            if isinstance(ticket, PushTicketError):
                error = ticket
                ticket_token = ticket.push_token

                # Check if token is invalid and should be removed
                if error.code in ("DeviceNotRegistered", "InvalidCredentials"):
                    logger.warning(
                        "Invalid Expo token detected for notification %s (platform: %s): %s - %s",
                        notification_id,
                        token_to_platform.get(ticket_token, "unknown"),
                        error.code,
                        error.message,
                    )
                    # Find and mark token for deletion
                    # The ticket.push_token might be in different format, so check both
                    for device_token, platform in expo_tokens:
                        # Check if this is the token that failed (handle both formats)
                        if (device_token == ticket_token or 
                            ticket_token in device_token or 
                            device_token in ticket_token):
                            invalid_tokens.append(device_token)
                            break
                else:
                    logger.error(
                        "Failed to deliver Expo push notification %s to token %s (platform: %s): %s - %s",
                        notification_id,
                        ticket_token[:20] + "..." if ticket_token else "unknown",
                        token_to_platform.get(ticket_token, "unknown"),
                        error.code if hasattr(error, 'code') else "Unknown",
                        error.message if hasattr(error, 'message') else str(error),
                    )
            else:
                # Success - log the delivery
                ticket_token = ticket.push_token if hasattr(ticket, 'push_token') else "unknown"
                logger.info(
                    "Successfully delivered Expo push notification %s to token %s (platform: %s)",
                    notification_id,
                    ticket_token[:20] + "..." if ticket_token and ticket_token != "unknown" else "unknown",
                    token_to_platform.get(ticket_token, "unknown"),
                )


def _send_fcm_notifications(
    fcm_tokens: List[Tuple[str, str]],
    message_title: str,
    message_body: str,
    notification_data: dict,
    notification_id: int,
    recipient,
    invalid_tokens: List[str],
):
    """Send push notifications via Firebase Cloud Messaging (FCM) for web."""
    logger.info(
        "Sending push notification %s to user %s with %d FCM token(s)",
        notification_id,
        recipient.id,
        len(fcm_tokens),
    )

    firebase_app = _get_firebase_app()
    if not firebase_app:
        logger.warning("Firebase not configured. Skipping FCM notifications.")
        return

    try:
        from firebase_admin import messaging

        # Create message for each FCM token
        for token, platform in fcm_tokens:
            try:
                message = messaging.Message(
                    token=token,
                    notification=messaging.Notification(
                        title=message_title,
                        body=message_body,
                    ),
                    data={
                        k: str(v) for k, v in notification_data.items()
                    },
                    webpush=messaging.WebpushConfig(
                        notification=messaging.WebpushNotification(
                            title=message_title,
                            body=message_body,
                            icon="/icon.png",
                        ),
                        fcm_options=messaging.WebpushFCMOptions(
                            link=notification_data.get("target_url", "/app/notifications"),
                        ),
                    ),
                )

                response = messaging.send(message)
                logger.info(
                    "Successfully delivered FCM push notification %s to token %s: %s",
                    notification_id,
                    token[:20] + "...",
                    response,
                )
            except messaging.UnregisteredError:
                logger.warning(
                    "Invalid FCM token detected for notification %s: %s",
                    notification_id,
                    token[:20] + "...",
                )
                invalid_tokens.append(token)
            except messaging.InvalidArgumentError as e:
                logger.error(
                    "Invalid FCM token argument for notification %s: %s",
                    notification_id,
                    e,
                )
                invalid_tokens.append(token)
            except Exception as e:
                logger.error(
                    "Failed to deliver FCM push notification %s to token %s: %s",
                    notification_id,
                    token[:20] + "...",
                    e,
                )
    except ImportError:
        logger.warning("firebase-admin not installed. Skipping FCM notifications.")
    except Exception as e:
        logger.exception("Error sending FCM notifications: %s", e)
        raise
