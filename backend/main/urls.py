from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .feedback_view import FeedbackView
from .views import (
    PostViewSet,
    CommentViewSet,
    ReactionViewSet,
    NewsFeedView,
    NotificationViewSet,
    BookmarkViewSet,
    DeviceTokenViewSet,
    ConversationViewSet,
    PageViewSet,
    PageAdminInviteViewSet,
    FirebaseConfigView,
    RedisHealthView,
    WebSocketDiagnosticView,
    TestPushNotificationView,
)
from .views_uploads import UploadImageView

router = DefaultRouter()
router.register("posts", PostViewSet, basename="posts")
router.register("comments", CommentViewSet, basename="comments")
router.register("reactions", ReactionViewSet, basename="reactions")
router.register("notifications", NotificationViewSet, basename="notifications")
router.register("bookmarks", BookmarkViewSet, basename="bookmarks")
router.register("device-tokens", DeviceTokenViewSet, basename="device-tokens")
router.register("conversations", ConversationViewSet, basename="conversations")
router.register("pages", PageViewSet, basename="pages")
router.register("admin-invites", PageAdminInviteViewSet, basename="admin-invites")

urlpatterns = [
    path("", include(router.urls)),
    path("feed/", NewsFeedView.as_view(), name="newsfeed"),
    path("feedback/", FeedbackView.as_view(), name="feedback"),
    path("uploads/images/", UploadImageView.as_view(), name="upload-image"),
    path("firebase-config/", FirebaseConfigView.as_view(), name="firebase-config"),
    path("redis-health/", RedisHealthView.as_view(), name="redis-health"),
    path("ws-diagnostic/", WebSocketDiagnosticView.as_view(), name="ws-diagnostic"),
    path("test-push-notification/", TestPushNotificationView.as_view(), name="test-push-notification"),
]
