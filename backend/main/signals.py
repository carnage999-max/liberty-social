import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Reaction, Comment, Notification, Post
from .realtime import notification_group_name

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Comment)
def comment_notification(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        post = instance.post
        owner = getattr(post, 'author', None)
        if owner and owner != instance.author:
            # Store the post as the target so users can navigate to it
            post_content_type = ContentType.objects.get_for_model(Post)
            Notification.objects.create(
                recipient=owner,
                actor=instance.author,
                verb='commented',
                content_type=post_content_type,
                object_id=post.id
            )
    except Exception:
        logger.exception("Failed to create comment notification", exc_info=True)


@receiver(post_save, sender=Reaction)
def reaction_notification(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        target = instance.content_object
        owner = getattr(target, 'author', None)
        if owner and owner != instance.user:
            # For reactions, we need to get the post ID
            # If reaction is on a comment, get the post from the comment
            # If reaction is on a post, use the post directly
            post_content_type = ContentType.objects.get_for_model(Post)
            if isinstance(target, Comment):
                post = target.post
                Notification.objects.create(
                    recipient=owner,
                    actor=instance.user,
                    verb='reacted',
                    content_type=post_content_type,
                    object_id=post.id
                )
            elif isinstance(target, Post):
                Notification.objects.create(
                    recipient=owner,
                    actor=instance.user,
                    verb='reacted',
                    content_type=post_content_type,
                    object_id=target.id
                )
    except Exception:
        logger.exception("Failed to create reaction notification", exc_info=True)


@receiver(post_save, sender=Notification)
def dispatch_notification(sender, instance, created, **kwargs):
    if not created:
        return

    channel_layer = get_channel_layer()
    if channel_layer:
        try:
            from .serializers import NotificationSerializer

            payload = NotificationSerializer(instance).data
            async_to_sync(channel_layer.group_send)(
                notification_group_name(instance.recipient_id),
                {"type": "notification.created", "data": payload},
            )
        except Exception:
            logger.exception(
                "Failed to broadcast notification %s via websocket", instance.pk
            )

    if getattr(settings, "PUSH_NOTIFICATIONS_ENABLED", False):
        try:
            from .tasks import deliver_push_notification

            deliver_push_notification.delay(instance.pk)
        except Exception:
            logger.exception(
                "Failed to enqueue push notification for %s", instance.pk
            )
