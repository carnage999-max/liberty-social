from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.decorators import action
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
import csv

from .moderation_models import (
    Appeal,
    ComplianceLog,
    ContentClassification,
    ModerationAction,
    UserFilterPreference,
    UserFilterProfile,
)
from .models import (
    Post,
    Comment,
    Message,
    Page,
    YardSaleListing,
)
from .marketplace_models import MarketplaceListing
from .animal_models import AnimalListing, BreederDirectory
from .moderation_serializers import (
    AppealSerializer,
    ComplianceLogSerializer,
    ContentClassificationSerializer,
    ModerationActionSerializer,
    UserFilterPreferenceSerializer,
    UserFilterProfileSerializer,
)


def _can_user_appeal(action: ModerationAction, user) -> bool:
    if action.actor_id == user.id:
        return True
    obj = action.content_object
    if not obj:
        return False
    for attr in ("author", "created_by", "seller", "user"):
        if hasattr(obj, attr) and getattr(obj, attr) == user:
            return True
    return False


class ModerationActionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ModerationActionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ModerationAction.objects.all().select_related("content_type", "actor")
        if not self.request.user.is_staff:
            user = self.request.user
            from django.contrib.auth import get_user_model

            User = get_user_model()
            ownership_filters = [
                (Post, Post.objects.filter(author=user).values_list("id", flat=True)),
                (Comment, Comment.objects.filter(author=user).values_list("id", flat=True)),
                (Message, Message.objects.filter(sender=user).values_list("id", flat=True)),
                (Page, Page.objects.filter(created_by=user).values_list("id", flat=True)),
                (MarketplaceListing, MarketplaceListing.objects.filter(seller=user).values_list("id", flat=True)),
                (AnimalListing, AnimalListing.objects.filter(seller=user).values_list("id", flat=True)),
                (BreederDirectory, BreederDirectory.objects.filter(seller__user=user).values_list("id", flat=True)),
                (YardSaleListing, YardSaleListing.objects.filter(user=user).values_list("id", flat=True)),
                (User, User.objects.filter(id=user.id).values_list("id", flat=True)),
            ]

            q = models.Q(actor=user)
            for model, ids in ownership_filters:
                ids_list = [str(pk) for pk in ids]
                if not ids_list:
                    continue
                ct = ContentType.objects.get_for_model(model)
                q |= models.Q(content_type=ct, object_id__in=ids_list)

            qs = qs.filter(q)

        content_type = self.request.query_params.get("content_type")
        object_id = self.request.query_params.get("object_id")
        layer = self.request.query_params.get("layer")
        action = self.request.query_params.get("action")

        if content_type:
            try:
                app_label, model = content_type.split(".")
                ct = ContentType.objects.get(app_label=app_label, model=model)
                qs = qs.filter(content_type=ct)
            except Exception:
                qs = qs.none()
        if object_id:
            qs = qs.filter(object_id=str(object_id))
        if layer:
            qs = qs.filter(layer=layer)
        if action:
            qs = qs.filter(action=action)
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if start:
            dt = parse_datetime(start)
            if dt:
                qs = qs.filter(created_at__gte=dt)
        if end:
            dt = parse_datetime(end)
            if dt:
                qs = qs.filter(created_at__lte=dt)
        return qs.order_by("-created_at")

    @action(detail=False, methods=["get"], permission_classes=[IsAdminUser], url_path="export")
    def export(self, request):
        qs = self.get_queryset()
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="moderation_actions.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "id",
                "layer",
                "action",
                "reason_code",
                "rule_ref",
                "content_type",
                "object_id",
                "actor_id",
                "created_at",
            ]
        )
        for item in qs.iterator():
            writer.writerow(
                [
                    item.id,
                    item.layer,
                    item.action,
                    item.reason_code,
                    item.rule_ref,
                    item.content_type.model if item.content_type else "",
                    item.object_id or "",
                    item.actor_id or "",
                    item.created_at.isoformat(),
                ]
            )
        return response


class UserFilterProfileViewSet(viewsets.ModelViewSet):
    serializer_class = UserFilterProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserFilterProfile.objects.filter(user=self.request.user).order_by(
            "-updated_at"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data.get("name") or "Default"
        try:
            profile, created = UserFilterProfile.objects.get_or_create(
                user=request.user, name=name, defaults=serializer.validated_data
            )
        except Exception:
            profile = UserFilterProfile.objects.filter(
                user=request.user, name=name
            ).first()
            if not profile:
                raise
            created = False
        if not created:
            for field, value in serializer.validated_data.items():
                setattr(profile, field, value)
            profile.save()
        output = self.get_serializer(profile)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(output.data, status=status_code)


class UserFilterPreferenceViewSet(viewsets.ModelViewSet):
    serializer_class = UserFilterPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserFilterPreference.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        preference, _ = UserFilterPreference.objects.get_or_create(user=request.user)
        serializer = self.get_serializer(preference)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        preference, _ = UserFilterPreference.objects.get_or_create(user=request.user)
        serializer = self.get_serializer(
            preference, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        preference, _ = UserFilterPreference.objects.get_or_create(user=request.user)
        serializer = self.get_serializer(
            preference, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class AppealViewSet(viewsets.ModelViewSet):
    serializer_class = AppealSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Appeal.objects.select_related(
            "moderation_action", "user", "decided_by"
        )
        if self.request.user.is_staff:
            return qs.order_by("-created_at")
        return qs.filter(user=self.request.user).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["moderation_action"]
        if not _can_user_appeal(action, request.user):
            return Response(
                {"detail": "You are not allowed to appeal this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ContentClassificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ContentClassificationSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = ContentClassification.objects.select_related("content_type", "actor")
        content_type = self.request.query_params.get("content_type")
        object_id = self.request.query_params.get("object_id")
        label = self.request.query_params.get("label")
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if content_type:
            try:
                app_label, model = content_type.split(".")
                ct = ContentType.objects.get(app_label=app_label, model=model)
                qs = qs.filter(content_type=ct)
            except Exception:
                return qs.none()
        if object_id:
            qs = qs.filter(object_id=str(object_id))
        if label:
            qs = qs.filter(labels__contains=[label])
        if start:
            dt = parse_datetime(start)
            if dt:
                qs = qs.filter(created_at__gte=dt)
        if end:
            dt = parse_datetime(end)
            if dt:
                qs = qs.filter(created_at__lte=dt)
        return qs.order_by("-created_at")

    @action(detail=False, methods=["get"], permission_classes=[IsAdminUser], url_path="export")
    def export(self, request):
        qs = self.get_queryset()
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="content_classifications.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "id",
                "content_type",
                "object_id",
                "model_version",
                "labels",
                "actor_id",
                "created_at",
            ]
        )
        for item in qs.iterator():
            writer.writerow(
                [
                    item.id,
                    item.content_type.model if item.content_type else "",
                    item.object_id,
                    item.model_version,
                    "|".join(item.labels or []),
                    item.actor_id or "",
                    item.created_at.isoformat(),
                ]
            )
        return response


class ComplianceLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ComplianceLogSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = ComplianceLog.objects.select_related("content_type", "actor")
        category = self.request.query_params.get("category")
        layer = self.request.query_params.get("layer")
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if category:
            qs = qs.filter(category=category)
        if layer:
            qs = qs.filter(layer=layer)
        if start:
            dt = parse_datetime(start)
            if dt:
                qs = qs.filter(created_at__gte=dt)
        if end:
            dt = parse_datetime(end)
            if dt:
                qs = qs.filter(created_at__lte=dt)
        return qs.order_by("-created_at")

    @action(detail=False, methods=["get"], permission_classes=[IsAdminUser], url_path="export")
    def export(self, request):
        qs = self.get_queryset()
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="compliance_logs.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "id",
                "layer",
                "category",
                "content_type",
                "object_id",
                "actor_id",
                "created_at",
            ]
        )
        for item in qs.iterator():
            writer.writerow(
                [
                    item.id,
                    item.layer,
                    item.category,
                    item.content_type.model if item.content_type else "",
                    item.object_id or "",
                    item.actor_id or "",
                    item.created_at.isoformat(),
                ]
            )
        return response


class AppealAdminViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AppealSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Appeal.objects.select_related("moderation_action", "user", "decided_by")
        status_filter = self.request.query_params.get("status")
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if start:
            dt = parse_datetime(start)
            if dt:
                qs = qs.filter(created_at__gte=dt)
        if end:
            dt = parse_datetime(end)
            if dt:
                qs = qs.filter(created_at__lte=dt)
        return qs.order_by("-created_at")

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser], url_path="decide")
    def decide(self, request, pk=None):
        appeal = self.get_object()
        decision = request.data.get("decision")
        if decision not in ("approved", "rejected"):
            return Response(
                {"detail": "decision must be approved or rejected"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        appeal.status = decision
        appeal.decided_by = request.user
        appeal.decided_at = timezone.now()
        appeal.save(update_fields=["status", "decided_by", "decided_at"])
        return Response(self.get_serializer(appeal).data)

    @action(detail=False, methods=["post"], permission_classes=[IsAdminUser], url_path="bulk-decide")
    def bulk_decide(self, request):
        ids = request.data.get("ids") or []
        decision = request.data.get("decision")
        if not isinstance(ids, list) or not ids:
            return Response(
                {"detail": "ids must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if decision not in ("approved", "rejected"):
            return Response(
                {"detail": "decision must be approved or rejected"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        now = timezone.now()
        updated = (
            Appeal.objects.filter(id__in=ids)
            .exclude(status=decision)
            .update(status=decision, decided_by=request.user, decided_at=now)
        )
        return Response({"updated": updated, "decision": decision})
