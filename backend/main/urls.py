from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PostViewSet, CommentViewSet, ReactionViewSet, NewsFeedView, NotificationViewSet, BookmarkViewSet
from .views_uploads import UploadImageView

router = DefaultRouter()
router.register('posts', PostViewSet, basename='posts')
router.register('comments', CommentViewSet, basename='comments')
router.register('reactions', ReactionViewSet, basename='reactions')
router.register('notifications', NotificationViewSet, basename='notifications')
router.register('bookmarks', BookmarkViewSet, basename='bookmarks')

urlpatterns = [
	path('', include(router.urls)),
	path('feed/', NewsFeedView.as_view(), name='newsfeed')
,
	path('uploads/images/', UploadImageView.as_view(), name='upload-image')
]

