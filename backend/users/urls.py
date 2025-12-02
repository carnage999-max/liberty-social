from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .password_reset_view import PasswordResetView, PasswordResetConfirmView
from .password_change_request_view import RequestPasswordChangeView
from .views import (
    BlockedUsersViewset,
    ChangePasswordView,
    DismissedSuggestionViewset,
    FriendRequestViewset,
    FriendsViewset,
    FriendshipHistoryViewSet,
    LoginUserview,
    LogoutView,
    ProfilePictureUploadView,
    RegisterUserViewSet,
    UserSettingsView,
    UserView,
    UserOverviewView,
    UserMetricsView,
    OnlineUsersView,
    AccountDeletionRequestView,
)

router = DefaultRouter()
router.register("login", LoginUserview, basename="login")
router.register("register", RegisterUserViewSet, basename="register")
router.register("user", UserView, basename="user")
router.register("friends", FriendsViewset, basename="friends")
router.register("friend-requests", FriendRequestViewset, basename="friend-requests")
router.register("blocks", BlockedUsersViewset, basename="blocks")
router.register(
    "dismissed-suggestions",
    DismissedSuggestionViewset,
    basename="dismissed-suggestions",
)
router.register(
    "friendship-history", FriendshipHistoryViewSet, basename="friendship-history"
)

urlpatterns = [
    path("", include(router.urls)),
    path("logout/", LogoutView, name="logout"),
    path(
        "profile/upload-picture/",
        ProfilePictureUploadView.as_view(),
        name="profile-upload",
    ),
    path("password-reset/", PasswordResetView.as_view(), name="password-reset"),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path(
        "request-password-change/",
        RequestPasswordChangeView.as_view(),
        name="request-password-change",
    ),
    path("settings/", UserSettingsView.as_view(), name="user-settings"),
    path(
        "user/<uuid:user_id>/overview/",
        UserOverviewView.as_view(),
        name="user-overview",
    ),
    path("metrics/summary/", UserMetricsView.as_view(), name="user-metrics"),
    path("online/", OnlineUsersView.as_view(), name="online-users"),
    path(
        "request-deletion/",
        AccountDeletionRequestView.as_view(),
        name="request-account-deletion",
    ),
]
