from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiExample
from rest_framework.pagination import PageNumberPagination
from rest_framework import status
from django.db.models import Q
from .models import Post, Comment, Reaction, Bookmark
from .serializers import PostSerializer, CommentSerializer, ReactionSerializer, NotificationSerializer
from .serializers import BookmarkSerializer
from users.models import Friends
from .models import Notification


class PostViewSet(ModelViewSet):
	queryset = Post.objects.all()
	serializer_class = PostSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		# exclude soft-deleted posts, newest first, include related data
		return (
			Post.objects.filter(deleted_at__isnull=True)
			.select_related("author")
			.prefetch_related("comments__author", "media")
			.order_by("-created_at")
		)

	def perform_create(self, serializer):
		serializer.save(author=self.request.user)

	def perform_update(self, serializer):
		# mark edited
		serializer.save(edited_at=__import__('django.utils.timezone', fromlist=['now']).timezone.now())

	def perform_destroy(self, instance):
		# soft delete
		instance.deleted_at = __import__('django.utils.timezone', fromlist=['now']).timezone.now()
		instance.save()


class CommentViewSet(ModelViewSet):
	queryset = Comment.objects.all()
	serializer_class = CommentSerializer
	permission_classes = [IsAuthenticated]

	def perform_create(self, serializer):
		serializer.save(author=self.request.user)


class ReactionViewSet(ModelViewSet):
	queryset = Reaction.objects.all()
	serializer_class = ReactionSerializer
	permission_classes = [IsAuthenticated]

	def perform_create(self, serializer):
		instance = serializer.save(user=self.request.user)
		# create a notification for the owner of the target object (if different)
		try:
			target = instance.content_object
			owner = getattr(target, 'author', None)
			if owner and owner != self.request.user:
				Notification.objects.create(recipient=owner, actor=self.request.user, verb='reacted', content_type=instance.content_type, object_id=instance.object_id)
		except Exception:
			pass


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
			.prefetch_related('comments__author', 'media')
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
