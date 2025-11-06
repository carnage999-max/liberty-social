from typing import Sequence

from celery import shared_task
from django.conf import settings

from .models import Notification


def _chunk_tokens(tokens: Sequence[str], size: int = 900):
    for index in range(0, len(tokens), size):
        yield tokens[index : index + size]


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
    server_key = getattr(settings, "FIREBASE_SERVER_KEY", "")
    if not server_key:
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

    try:
        from pyfcm import FCMNotification
    except Exception as exc:  # pragma: no cover - pyfcm import failure
        raise self.retry(exc=exc)

    push_service = FCMNotification(api_key=server_key)
    message_title = "Liberty Social"
    message_body = f"{actor_label} {verb}"

    for batch in _chunk_tokens(tokens):
        result = push_service.notify_multiple_devices(
            registration_ids=list(batch),
            message_title=message_title,
            message_body=message_body,
            sound="default",
            data_message={"notification": payload},
        )
        # pyfcm returns a dict. If it contains failures caused by invalid tokens,
        # prune them so they cannot cause repeated failures.
        if result and isinstance(result, dict):
            invalid_tokens = []
            responses = result.get("results") or []
            for token, response in zip(batch, responses):
                if not isinstance(response, dict):
                    continue
                if response.get("error") in {"NotRegistered", "InvalidRegistration"}:
                    invalid_tokens.append(token)
                if response.get("registration_id"):
                    invalid_tokens.append(token)
            if invalid_tokens:
                recipient.device_tokens.filter(token__in=invalid_tokens).delete()
