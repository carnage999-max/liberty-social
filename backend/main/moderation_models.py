from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class ContentClassification(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=64)
    content_object = GenericForeignKey("content_type", "object_id")
    model_version = models.CharField(max_length=64)
    labels = models.JSONField(default=list)
    confidences = models.JSONField(default=dict)
    features = models.JSONField(default=dict)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["created_at"]),
        ]


class ModerationAction(models.Model):
    content_type = models.ForeignKey(
        ContentType, null=True, blank=True, on_delete=models.SET_NULL
    )
    object_id = models.CharField(max_length=64, null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")
    layer = models.CharField(max_length=8)
    action = models.CharField(max_length=32)
    reason_code = models.CharField(max_length=64)
    rule_ref = models.CharField(max_length=64)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["layer", "action"]),
            models.Index(fields=["created_at"]),
        ]


class ComplianceLog(models.Model):
    action = models.ForeignKey(
        ModerationAction, null=True, blank=True, on_delete=models.SET_NULL
    )
    layer = models.CharField(max_length=8)
    category = models.CharField(max_length=64)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    content_type = models.ForeignKey(
        ContentType, null=True, blank=True, on_delete=models.SET_NULL
    )
    object_id = models.CharField(max_length=64, null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")
    content_snippet = models.TextField(blank=True)
    content_hash = models.CharField(max_length=128, blank=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["layer", "category"]),
            models.Index(fields=["created_at"]),
        ]


class UserFilterProfile(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="filter_profiles"
    )
    name = models.CharField(max_length=64)
    is_default = models.BooleanField(default=False)
    category_toggles = models.JSONField(default=dict)
    blur_thumbnails = models.BooleanField(default=False)
    age_gate = models.BooleanField(default=False)
    allow_explicit_content = models.BooleanField(default=False)
    blur_explicit_thumbnails = models.BooleanField(default=False)
    redact_profanity = models.BooleanField(default=False)
    keyword_mutes = models.JSONField(default=list)
    account_mutes = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "name")


class UserFilterPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="filter_preferences"
    )
    active_profile = models.ForeignKey(
        UserFilterProfile, null=True, blank=True, on_delete=models.SET_NULL
    )
    updated_at = models.DateTimeField(auto_now=True)


class Appeal(models.Model):
    moderation_action = models.ForeignKey(
        ModerationAction, on_delete=models.CASCADE, related_name="appeals"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="moderation_appeals"
    )
    reason = models.TextField()
    status = models.CharField(max_length=32, default="pending")
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="moderation_appeals_decided",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
        ]
