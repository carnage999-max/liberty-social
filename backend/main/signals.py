import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Reaction, Comment, Notification, Post, UserFeedPreference, Message
from users.models import FriendRequest

User = get_user_model()
logger = logging.getLogger(__name__)


@receiver(post_save, sender=Comment)
def comment_notification(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        post = instance.post
        owner = getattr(post, "author", None)
        if owner and owner != instance.author:
            # Store the post as the target so users can navigate to it
            post_content_type = ContentType.objects.get_for_model(Post)
            Notification.objects.create(
                recipient=owner,
                actor=instance.author,
                verb="commented",
                content_type=post_content_type,
                object_id=post.id,
            )
        parent = getattr(instance, "parent", None)
        if parent and parent.author and parent.author not in {instance.author, owner}:
            comment_content_type = ContentType.objects.get_for_model(Comment)
            Notification.objects.create(
                recipient=parent.author,
                actor=instance.author,
                verb="comment_replied",
                content_type=comment_content_type,
                object_id=instance.id,
            )
    except Exception:
        logger.exception("Failed to create comment notification", exc_info=True)


@receiver(post_save, sender=Reaction)
def reaction_notification(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        target = instance.content_object
        owner = getattr(target, "author", None)
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
                    verb="reacted",
                    content_type=post_content_type,
                    object_id=post.id,
                )
            elif isinstance(target, Post):
                Notification.objects.create(
                    recipient=owner,
                    actor=instance.user,
                    verb="reacted",
                    content_type=post_content_type,
                    object_id=target.id,
                )
    except Exception:
        logger.exception("Failed to create reaction notification", exc_info=True)


@receiver(post_save, sender=FriendRequest)
def friend_request_notifications(sender, instance, created, **kwargs):
    try:
        friend_request_ct = ContentType.objects.get_for_model(FriendRequest)
        if created and instance.to_user != instance.from_user:
            Notification.objects.create(
                recipient=instance.to_user,
                actor=instance.from_user,
                verb="friend_request",
                content_type=friend_request_ct,
                object_id=instance.id,
            )
            return

        if (
            not created
            and instance.status == "accepted"
            and instance.to_user != instance.from_user
        ):
            already_sent = Notification.objects.filter(
                recipient=instance.from_user,
                actor=instance.to_user,
                verb="friend_request_accepted",
                content_type=friend_request_ct,
                object_id=instance.id,
            ).exists()
            if not already_sent:
                Notification.objects.create(
                    recipient=instance.from_user,
                    actor=instance.to_user,
                    verb="friend_request_accepted",
                    content_type=friend_request_ct,
                    object_id=instance.id,
                )
    except Exception:
        logger.exception("Failed to create friend request notification", exc_info=True)


@receiver(post_save, sender=Notification)
def dispatch_notification(sender, instance, created, **kwargs):
    if not created:
        return

    # Broadcast via WebSocket for mobile app
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from .realtime import notification_group_name
        from .serializers import NotificationSerializer

        layer = get_channel_layer()
        if layer:
            serializer = NotificationSerializer(instance)
            async_to_sync(layer.group_send)(
                notification_group_name(str(instance.recipient.id)),
                {
                    "type": "notification_created",
                    "data": serializer.data,
                },
            )
    except Exception:
        logger.exception(
            "Failed to broadcast notification via WebSocket for %s", instance.pk
        )

    # Queue push notification for web/mobile
    if getattr(settings, "PUSH_NOTIFICATIONS_ENABLED", False):
        try:
            from .tasks import deliver_push_notification

            deliver_push_notification.delay(instance.pk)
        except Exception:
            logger.exception("Failed to enqueue push notification for %s", instance.pk)


@receiver(post_save, sender=User)
def create_user_feed_preference(sender, instance, created, **kwargs):
    """Auto-create feed preferences for new users with all categories enabled"""
    if created:
        try:
            UserFeedPreference.objects.get_or_create(
                user=instance,
                defaults={
                    "show_friend_posts": True,
                    "show_page_posts": True,
                    "show_other_categories": True,
                    # Initialize with all categories enabled
                    "preferred_categories": [
                        "business",
                        "community",
                        "brand",
                        "news",
                        "restaurant",
                        "entertainment",
                        "hobbies",
                        "work",
                        "associates",
                        "sports",
                        "music",
                        "art",
                        "tech",
                        "lifestyle",
                        "education",
                        "health",
                        "travel",
                        "food",
                        "fashion",
                        "games",
                        "other",
                    ],
                },
            )
        except Exception:
            logger.exception(
                "Failed to create user feed preference for user %s", instance.pk
            )


@receiver(post_save, sender=Message)
def message_notification(sender, instance, created, **kwargs):
    """Create notifications and send push notifications when a message is received."""
    if not created:
        return

    try:
        conversation = instance.conversation
        sender_user = instance.sender

        # Get all participants in the conversation except the sender
        participants = conversation.participants.exclude(id=sender_user.id)

        # Create notifications for each participant
        from django.contrib.contenttypes.models import ContentType

        message_content_type = ContentType.objects.get_for_model(Message)

        for recipient in participants:
            # Create notification
            notification = Notification.objects.create(
                recipient=recipient,
                actor=sender_user,
                verb="sent_message",
                content_type=message_content_type,
                object_id=instance.id,
            )

            # Queue push notification
            if getattr(settings, "PUSH_NOTIFICATIONS_ENABLED", False):
                try:
                    from .tasks import deliver_push_notification

                    deliver_push_notification.delay(notification.pk)
                except Exception:
                    logger.exception(
                        "Failed to enqueue push notification for message %s to user %s",
                        instance.pk,
                        recipient.pk,
                    )
    except Exception:
        logger.exception(
            "Failed to create message notification for message %s", instance.pk
        )
