from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Reaction, Comment, Notification


@receiver(post_save, sender=Comment)
def comment_notification(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        post = instance.post
        owner = getattr(post, 'author', None)
        if owner and owner != instance.author:
            Notification.objects.create(recipient=owner, actor=instance.author, verb='commented', content_type=None, object_id=None)
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
            Notification.objects.create(recipient=owner, actor=instance.user, verb='reacted', content_type=instance.content_type, object_id=instance.object_id)
    except Exception:
        pass
