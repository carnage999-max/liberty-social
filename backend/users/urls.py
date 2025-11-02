from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .password_reset_view import PasswordResetView
from .views import (
    BlockedUsersViewset,
    FriendRequestViewset,
    FriendsViewset,
    LoginUserview,
    LogoutView,
    ProfilePictureUploadView,
    RegisterUserViewSet,
    UserSettingsView,
    UserView,
)

router = DefaultRouter()
router.register("login", LoginUserview, basename="login")
router.register("register", RegisterUserViewSet, basename="register")
router.register("user", UserView, basename="user")
router.register("friends", FriendsViewset, basename="friends")
router.register("friend-requests", FriendRequestViewset, basename="friend-requests")
router.register("blocks", BlockedUsersViewset, basename="blocks")

urlpatterns = [
    path("", include(router.urls)),
    path("logout/", LogoutView, name="logout"),
    path("profile/upload-picture/", ProfilePictureUploadView.as_view(), name="profile-upload"),
    path("password-reset/", PasswordResetView.as_view(), name="password-reset"),
    path("settings/", UserSettingsView.as_view(), name="user-settings"),
]
