from rest_framework import serializers

from .moderation_models import (
    Appeal,
    ComplianceLog,
    ContentClassification,
    ModerationAction,
    UserFilterPreference,
    UserFilterProfile,
)


class ModerationActionSerializer(serializers.ModelSerializer):
    content_type = serializers.SerializerMethodField()

    class Meta:
        model = ModerationAction
        fields = [
            "id",
            "content_type",
            "object_id",
            "layer",
            "action",
            "reason_code",
            "rule_ref",
            "metadata",
            "actor",
            "created_at",
        ]
        read_only_fields = fields

    def get_content_type(self, obj):
        if not obj.content_type:
            return None
        return {
            "id": obj.content_type.id,
            "app_label": obj.content_type.app_label,
            "model": obj.content_type.model,
        }


class ContentClassificationSerializer(serializers.ModelSerializer):
    content_type = serializers.SerializerMethodField()

    class Meta:
        model = ContentClassification
        fields = [
            "id",
            "content_type",
            "object_id",
            "model_version",
            "labels",
            "confidences",
            "features",
            "actor",
            "created_at",
        ]
        read_only_fields = fields

    def get_content_type(self, obj):
        if not obj.content_type:
            return None
        return {
            "id": obj.content_type.id,
            "app_label": obj.content_type.app_label,
            "model": obj.content_type.model,
        }


class ComplianceLogSerializer(serializers.ModelSerializer):
    content_type = serializers.SerializerMethodField()

    class Meta:
        model = ComplianceLog
        fields = [
            "id",
            "layer",
            "category",
            "content_type",
            "object_id",
            "content_snippet",
            "content_hash",
            "metadata",
            "actor",
            "created_at",
        ]
        read_only_fields = fields

    def get_content_type(self, obj):
        if not obj.content_type:
            return None
        return {
            "id": obj.content_type.id,
            "app_label": obj.content_type.app_label,
            "model": obj.content_type.model,
        }


class UserFilterProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserFilterProfile
        fields = [
            "id",
            "name",
            "is_default",
            "category_toggles",
            "blur_thumbnails",
            "age_gate",
            "allow_explicit_content",
            "blur_explicit_thumbnails",
            "redact_profanity",
            "keyword_mutes",
            "account_mutes",
            "created_at",
            "updated_at",
        ]


class UserFilterPreferenceSerializer(serializers.ModelSerializer):
    active_profile = UserFilterProfileSerializer(read_only=True)
    active_profile_id = serializers.PrimaryKeyRelatedField(
        source="active_profile",
        queryset=UserFilterProfile.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )

    class Meta:
        model = UserFilterPreference
        fields = [
            "id",
            "active_profile",
            "active_profile_id",
            "updated_at",
        ]


class AppealSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appeal
        fields = [
            "id",
            "moderation_action",
            "user",
            "reason",
            "status",
            "decided_by",
            "decided_at",
            "created_at",
        ]
        read_only_fields = [
            "user",
            "status",
            "decided_by",
            "decided_at",
            "created_at",
        ]
