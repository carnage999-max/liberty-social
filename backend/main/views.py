from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.contenttypes.models import ContentType
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiExample
from rest_framework.pagination import PageNumberPagination
from rest_framework import status
from django.db.models import Q
from django.utils import timezone
from django.conf import settings
from .models import (
    Post,
    Comment,
    Reaction,
    Bookmark,
    Notification,
    DeviceToken,
    Conversation,
    ConversationParticipant,
    Message,
)
from .realtime import conversation_group_name
from .serializers import (
    PostSerializer,
    CommentSerializer,
    ReactionSerializer,
    NotificationSerializer,
    BookmarkSerializer,
    DeviceTokenSerializer,
    ConversationSerializer,
    MessageSerializer,
)
from users.models import Friends


class PostViewSet(ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            Post.objects.filter(deleted_at__isnull=True)
            .select_related("author")
            .prefetch_related(
                "comments__author",
                "comments__media",
                "comments__reactions__user",
                "comments__replies",
                "media",
                "reactions__user",
                "bookmarks__user",
            )
            .order_by("-created_at")
        )
        mine = self.request.query_params.get("mine")
        if mine is not None and str(mine).lower() in ("1", "true", "yes"):
            return qs.filter(author=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.author != self.request.user:
            raise PermissionDenied("You are not allowed to edit this post.")
        serializer.save(edited_at=timezone.now())

    def perform_destroy(self, instance):
        if instance.author != self.request.user:
            raise PermissionDenied("You are not allowed to delete this post.")
        instance.deleted_at = timezone.now()
        instance.save()


class CommentViewSet(ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.author != self.request.user:
            raise PermissionDenied("You are not allowed to edit this comment.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.author != self.request.user:
            raise PermissionDenied("You are not allowed to delete this comment.")
        instance.delete()


class ReactionViewSet(ModelViewSet):
    queryset = Reaction.objects.all()
    serializer_class = ReactionSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        # Notification is now handled by the signal in signals.py


class NotificationViewSet(ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        n = self.get_object()
        if n.recipient != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        n.unread = False
        n.save()
        return Response({"status": "ok"})

    @action(detail=False, methods=["post"], url_path="mark_all_read")
    def mark_all_read(self, request):
        updated = Notification.objects.filter(
            recipient=request.user, unread=True
        ).update(unread=False)
        return Response({"updated": updated})


class BookmarkViewSet(ModelViewSet):
    queryset = Bookmark.objects.all()
    serializer_class = BookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeviceTokenViewSet(ModelViewSet):
    queryset = DeviceToken.objects.all()
    serializer_class = DeviceTokenSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        return DeviceToken.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConversationViewSet(ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        user = self.request.user
        return (
            Conversation.objects.filter(participants__user=user)
            .select_related("created_by")
            .prefetch_related("participants__user")
            .distinct()
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.created_by != self.request.user:
            raise PermissionDenied("Only the creator can delete a conversation.")
        instance.delete()

    def _ensure_participant(self, conversation):
        if not conversation.participants.filter(user=self.request.user).exists():
            raise PermissionDenied("You are not a participant of this conversation.")
        return conversation

    @action(detail=True, methods=["get"], url_path="messages")
    def list_messages(self, request, pk=None):
        conversation = self._ensure_participant(self.get_object())
        paginator = PageNumberPagination()
        paginator.page_size = int(request.query_params.get("page_size", 25))
        qs = (
            conversation.messages.select_related("sender")
            .order_by("-created_at")
        )
        page = paginator.paginate_queryset(qs, request)
        serializer = MessageSerializer(page, many=True, context=self.get_serializer_context())
        return paginator.get_paginated_response(serializer.data)

    @list_messages.mapping.post
    def send_message(self, request, pk=None):
        conversation = self._ensure_participant(self.get_object())
        content = (request.data.get("content") or "").strip()
        media_url = request.data.get("media_url")
        reply_to_id = request.data.get("reply_to")

        if not content and not media_url:
            return Response(
                {"detail": "Message content or media_url is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reply_to = None
        if reply_to_id:
            try:
                reply_to = conversation.messages.get(id=reply_to_id)
            except Message.DoesNotExist:
                return Response(
                    {"detail": "Reply target not found in this conversation."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=content,
            media_url=media_url,
            reply_to=reply_to,
        )
        ConversationParticipant.objects.filter(
            conversation=conversation, user=request.user
        ).update(last_read_at=timezone.now())
        Conversation.objects.filter(id=conversation.id).update(
            last_message_at=message.created_at
        )

        recipients = conversation.participants.exclude(user=request.user).select_related("user")
        if recipients:
            conversation_ct = ContentType.objects.get_for_model(Conversation)
            Notification.objects.bulk_create(
                [
                    Notification(
                        recipient=participant.user,
                        actor=request.user,
                        verb="messaged",
                        content_type=conversation_ct,
                        object_id=conversation.id,
                    )
                    for participant in recipients
                ]
            )

        serializer = MessageSerializer(message, context=self.get_serializer_context())

        layer = get_channel_layer()
        if layer:
            try:
                async_to_sync(layer.group_send)(
                    conversation_group_name(str(conversation.id)),
                    {"type": "chat_message", "data": serializer.data},
                )
            except Exception:
                pass

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        conversation = self._ensure_participant(self.get_object())
        updated_count = ConversationParticipant.objects.filter(
            conversation=conversation, user=request.user
        ).update(last_read_at=timezone.now())
        return Response({"updated": updated_count})


class FirebaseConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, _request):
        config = {
            "apiKey": settings.FIREBASE_WEB_API_KEY,
            "authDomain": settings.FIREBASE_WEB_AUTH_DOMAIN,
            "projectId": settings.FIREBASE_WEB_PROJECT_ID,
            "storageBucket": settings.FIREBASE_WEB_STORAGE_BUCKET,
            "messagingSenderId": settings.FIREBASE_WEB_MESSAGING_SENDER_ID,
            "appId": settings.FIREBASE_WEB_APP_ID,
            "measurementId": settings.FIREBASE_WEB_MEASUREMENT_ID,
        }
        filtered = {key: value for key, value in config.items() if value}
        if not filtered:
            return Response(
                {"detail": "Firebase config unavailable."},
                status=status.HTTP_404_NOT_FOUND,
            )
        payload = {"config": filtered}
        if settings.FIREBASE_WEB_VAPID_KEY:
            payload["vapidKey"] = settings.FIREBASE_WEB_VAPID_KEY
        return Response(payload)


class RedisHealthView(APIView):
    """Diagnostic endpoint to test Redis connectivity for Channels."""

    permission_classes = [AllowAny]

    def get(self, request):
        import asyncio
        import logging

        logger = logging.getLogger(__name__)

        diagnostics = {
            "channel_layer_available": False,
            "redis_configured": False,
            "redis_connected": False,
            "error": None,
        }

        try:
            from channels.layers import get_channel_layer

            layer = get_channel_layer()
            if layer:
                diagnostics["channel_layer_available"] = True
                diagnostics["redis_configured"] = True

                # Test Redis connection
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        # Test connection by sending a test message
                        result = loop.run_until_complete(layer.test())
                        diagnostics["redis_connected"] = True
                        diagnostics["redis_test_result"] = result
                    except Exception as e:
                        diagnostics["redis_error"] = str(e)
                        logger.exception("Redis connection test failed")
                    finally:
                        loop.close()
                except Exception as e:
                    diagnostics["error"] = f"AsyncIO error: {str(e)}"
                    logger.exception("Error testing Redis connection")
            else:
                diagnostics["error"] = "No channel layer configured"
        except Exception as e:
            diagnostics["error"] = str(e)
            logger.exception("Error getting channel layer")

        status_code = (
            status.HTTP_200_OK
            if diagnostics["redis_connected"]
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return Response(diagnostics, status=status_code)


class WebSocketDiagnosticView(APIView):
    """Diagnostic endpoint to test WebSocket infrastructure."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        import asyncio
        import logging
        from django.conf import settings

        logger = logging.getLogger(__name__)

        diagnostics = {
            "user_authenticated": True,
            "user_id": request.user.id,
            "channel_layer_available": False,
            "redis_configured": False,
            "redis_connected": False,
            "allowed_hosts": getattr(settings, "ALLOWED_HOSTS", []),
            "redis_url_configured": bool(getattr(settings, "REDIS_URL", None)),
            "error": None,
        }

        try:
            from channels.layers import get_channel_layer

            layer = get_channel_layer()
            if layer:
                diagnostics["channel_layer_available"] = True
                diagnostics["redis_configured"] = True

                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        result = loop.run_until_complete(layer.test())
                        diagnostics["redis_connected"] = True
                        diagnostics["redis_test_result"] = result
                    except Exception as e:
                        diagnostics["redis_error"] = str(e)
                        logger.exception("Redis connection test failed")
                    finally:
                        loop.close()
                except Exception as e:
                    diagnostics["error"] = f"AsyncIO error: {str(e)}"
                    logger.exception("Error testing Redis connection")
            else:
                diagnostics["error"] = "No channel layer configured"
        except Exception as e:
            diagnostics["error"] = str(e)
            logger.exception("Error getting channel layer")

        status_code = (
            status.HTTP_200_OK
            if diagnostics["redis_connected"]
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return Response(diagnostics, status=status_code)


class NewsFeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # get friend ids
        friend_ids = Friends.objects.filter(user=user).values_list(
            "friend_id", flat=True
        )

        # build queryset: public posts OR user's own posts OR friends' posts with friends visibility
        qs = (
            Post.objects.filter(
                Q(visibility="public")
                | Q(author=user)
                | Q(author__id__in=friend_ids, visibility="friends")
            )
            .select_related("author")
            .prefetch_related(
                "comments__author",
                "comments__media",
                "media",
                "reactions__user",
                "bookmarks__user",
            )
        )

        # exclude posts where either side has blocked the other
        blocked_ids = set(list(Friends.objects.none()))
        from users.models import BlockedUsers

        user_blocked = BlockedUsers.objects.filter(user=user).values_list(
            "blocked_user_id", flat=True
        )
        blocked_me = BlockedUsers.objects.filter(blocked_user=user).values_list(
            "user_id", flat=True
        )
        excluded_authors = set(list(user_blocked)) | set(list(blocked_me))
        if excluded_authors:
            qs = qs.exclude(author__id__in=excluded_authors)

        # pagination
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(
            qs.distinct().order_by("-created_at"), request
        )
        serializer = PostSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
