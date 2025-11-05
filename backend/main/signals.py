from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from .models import Reaction, Comment, Notification, Post


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
        pass


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
        pass
