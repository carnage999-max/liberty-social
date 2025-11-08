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
from .models import Post, Comment, Reaction, Bookmark, Notification, DeviceToken
from .serializers import (
    PostSerializer,
    CommentSerializer,
    ReactionSerializer,
    NotificationSerializer,
    BookmarkSerializer,
    DeviceTokenSerializer,
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

	@action(detail=True, methods=['post'])
	def mark_read(self, request, pk=None):
		n = self.get_object()
		if n.recipient != request.user:
			return Response(status=status.HTTP_403_FORBIDDEN)
		n.unread = False
		n.save()
		return Response({'status': 'ok'})


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


class NewsFeedView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		user = request.user
		# get friend ids
		friend_ids = Friends.objects.filter(user=user).values_list('friend_id', flat=True)

		# build queryset: public posts OR user's own posts OR friends' posts with friends visibility
		qs = (
		Post.objects.filter(
			Q(visibility='public') |
			Q(author=user) |
			Q(author__id__in=friend_ids, visibility='friends')
		)
		.select_related('author')
		.prefetch_related('comments__author', 'comments__media', 'media', 'reactions__user', 'bookmarks__user')
		)

		# exclude posts where either side has blocked the other
		blocked_ids = set(list(Friends.objects.none()))
		from users.models import BlockedUsers
		user_blocked = BlockedUsers.objects.filter(user=user).values_list('blocked_user_id', flat=True)
		blocked_me = BlockedUsers.objects.filter(blocked_user=user).values_list('user_id', flat=True)
		excluded_authors = set(list(user_blocked)) | set(list(blocked_me))
		if excluded_authors:
			qs = qs.exclude(author__id__in=excluded_authors)

		# pagination
		paginator = PageNumberPagination()
		page = paginator.paginate_queryset(qs.distinct().order_by('-created_at'), request)
		serializer = PostSerializer(page, many=True, context={'request': request})
		return paginator.get_paginated_response(serializer.data)
