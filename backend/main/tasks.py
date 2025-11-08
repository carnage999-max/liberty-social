import base64
import json
import logging
from pathlib import Path
from threading import Lock
from typing import Optional

from celery import shared_task
from django.conf import settings
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

from .models import Notification

logger = logging.getLogger(__name__)

_SESSION_LOCK = Lock()
_AUTHORIZED_SESSION: Optional[AuthorizedSession] = None
_SESSION_PROJECT_ID: Optional[str] = None


def _load_service_account_info() -> Optional[dict]:
    raw_value = (getattr(settings, "FIREBASE_CREDENTIALS_JSON", "") or "").strip()
    if not raw_value:
        return None

    candidate = None
    if raw_value.startswith("{"):
        candidate = raw_value
    else:
        # Try base64 decode first (useful when storing JSON blobs in env vars).
        try:
            decoded = base64.b64decode(raw_value).decode("utf-8")
            if decoded.strip().startswith("{"):
                candidate = decoded
        except Exception:
            candidate = None
        if candidate is None:
            path = Path(raw_value)
            if path.exists():
                candidate = path.read_text()
    if not candidate:
        logger.error(
            "FIREBASE_CREDENTIALS_JSON is not valid JSON, base64, or a readable file"
        )
        return None
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        logger.exception("Failed to parse FIREBASE_CREDENTIALS_JSON")
        return None


def _get_authorized_session() -> tuple[Optional[AuthorizedSession], Optional[str]]:
    project_id = (getattr(settings, "FIREBASE_PROJECT_ID", "") or "").strip()
    if not project_id:
        return None, None

    global _AUTHORIZED_SESSION, _SESSION_PROJECT_ID
    with _SESSION_LOCK:
        if _AUTHORIZED_SESSION and _SESSION_PROJECT_ID == project_id:
            return _AUTHORIZED_SESSION, project_id

        info = _load_service_account_info()
        if not info:
            return None, None

        try:
            credentials = service_account.Credentials.from_service_account_info(
                info,
                scopes=["https://www.googleapis.com/auth/firebase.messaging"],
            )
        except Exception:
            logger.exception("Failed to build Firebase service account credentials")
            return None, None

        session = AuthorizedSession(credentials)
        _AUTHORIZED_SESSION = session
        _SESSION_PROJECT_ID = project_id
        return session, project_id


def _is_token_invalid(error_payload: Optional[dict]) -> bool:
    if not error_payload:
        return False
    error = error_payload.get("error", {})
    details = error.get("details") or []
    for detail in details:
        if (
            detail.get("@type")
            == "type.googleapis.com/google.firebase.fcm.v1.FcmError"
            and detail.get("errorCode") in {"UNREGISTERED", "INVALID_ARGUMENT"}
        ):
            return True
    message = (error.get("message") or "").lower()
    if "requested entity was not found" in message:
        return True
    if "registration token is not a valid fcm registration token" in message:
        return True
    return False


def _build_message_payload(
    token: str, notification_payload: dict, title: str, body: str
) -> dict:
    serialized = json.dumps(notification_payload)
    return {
        "token": token,
        "notification": {"title": title, "body": body},
        "data": {"notification": serialized},
        "webpush": {
            "notification": {
                "title": title,
                "body": body,
                "icon": "/icon.png",
            }
        },
    }


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    max_retries=5,
)
def deliver_push_notification(self, notification_id: int):
    """Send a push notification via FCM for a newly created Notification."""
    if not getattr(settings, "PUSH_NOTIFICATIONS_ENABLED", False):
        return

    session, project_id = _get_authorized_session()
    if not session or not project_id:
        logger.warning(
            "Push notifications enabled but Firebase credentials/project ID missing"
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
    tokens = list(recipient.device_tokens.values_list("token", flat=True))
    if not tokens:
        return

    actor = notification.actor
    actor_label = actor.get_full_name() or actor.username or actor.email or "Someone"
    verb = notification.verb

    from .serializers import NotificationSerializer  # local import to avoid cycles

    payload = NotificationSerializer(notification).data

    message_title = "Liberty Social"
    message_body = f"{actor_label} {verb}"
    endpoint = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    invalid_tokens = []

    for token in tokens:
        message = _build_message_payload(token, payload, message_title, message_body)
        try:
            response = session.post(
                endpoint, json={"message": message}, timeout=10  # seconds
            )
        except Exception as exc:
            raise self.retry(exc=exc)

        if response.ok:
            continue

        try:
            error_body = response.json()
        except ValueError:
            error_body = None

        if _is_token_invalid(error_body):
            invalid_tokens.append(token)
            continue

        logger.warning(
            "Failed to deliver push notification %s to token %s: %s",
            notification_id,
            token,
            error_body or response.text,
        )
        if response.status_code >= 500:
            raise self.retry(exc=Exception(response.text))

    if invalid_tokens:
        recipient.device_tokens.filter(token__in=invalid_tokens).delete()
