from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .password_reset_view import PasswordResetView, PasswordResetConfirmView
from .password_change_request_view import RequestPasswordChangeView
from .location_views import update_user_location, get_user_location
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
from .analytics_views import (
    analytics_overview,
    analytics_by_country,
    analytics_by_state,
    analytics_by_age,
    analytics_by_gender,
    analytics_micro_segmentation,
    analytics_top_countries,
)
from .passkey_views import (
    PasskeyRegisterBeginView,
    PasskeyRegisterCompleteView,
    PasskeyAuthenticateBeginView,
    PasskeyAuthenticateCompleteView,
    PasskeyStatusView,
    PasskeyRemoveView,
)
from .device_views import (
    DeviceListView,
    DeviceDetailView,
    SessionListView,
    SessionRevokeAllView,
    ActivityLogView,
)
from .admin_security_views import (
    UserSecurityView,
    UserDevicesView,
    UserActivityView,
    UserLockView,
    UserUnlockView,
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
    path("update-location/", update_user_location, name="update-location"),
    path("get-location/", get_user_location, name="get-location"),
    path(
        "user/<uuid:user_id>/overview/",
        UserOverviewView.as_view(),
        name="user-overview",
    ),
    path(
        "user/<str:user_ref>/overview/",
        UserOverviewView.as_view(),
        name="user-overview-slug",
    ),
    path("metrics/summary/", UserMetricsView.as_view(), name="user-metrics"),
    path("online/", OnlineUsersView.as_view(), name="online-users"),
    path(
        "request-deletion/",
        AccountDeletionRequestView.as_view(),
        name="request-account-deletion",
    ),
    # Passkey endpoints
    path(
        "passkey/register/begin/",
        PasskeyRegisterBeginView.as_view(),
        name="passkey-register-begin",
    ),
    path(
        "passkey/register/complete/",
        PasskeyRegisterCompleteView.as_view(),
        name="passkey-register-complete",
    ),
    path(
        "passkey/authenticate/begin/",
        PasskeyAuthenticateBeginView.as_view(),
        name="passkey-authenticate-begin",
    ),
    path(
        "passkey/authenticate/complete/",
        PasskeyAuthenticateCompleteView.as_view(),
        name="passkey-authenticate-complete",
    ),
    path(
        "passkey/status/",
        PasskeyStatusView.as_view(),
        name="passkey-status",
    ),
    path(
        "passkey/remove/<uuid:credential_id>/",
        PasskeyRemoveView.as_view(),
        name="passkey-remove",
    ),
    # Phase 2: Device and Session Management
    path(
        "devices/",
        DeviceListView.as_view(),
        name="device-list",
    ),
    path(
        "devices/<uuid:device_id>/",
        DeviceDetailView.as_view(),
        name="device-detail",
    ),
    path(
        "sessions/",
        SessionListView.as_view(),
        name="session-list",
    ),
    path(
        "sessions/revoke-all/",
        SessionRevokeAllView.as_view(),
        name="session-revoke-all",
    ),
    path(
        "activity/",
        ActivityLogView.as_view(),
        name="activity-log",
    ),
    # Phase 3: Admin Security Endpoints
    path(
        "admin/users/<uuid:user_id>/security/",
        UserSecurityView.as_view(),
        name="admin-user-security",
    ),
    path(
        "admin/users/<uuid:user_id>/devices/",
        UserDevicesView.as_view(),
        name="admin-user-devices",
    ),
    path(
        "admin/users/<uuid:user_id>/activity/",
        UserActivityView.as_view(),
        name="admin-user-activity",
    ),
    path(
        "admin/users/<uuid:user_id>/lock/",
        UserLockView.as_view(),
        name="admin-user-lock",
    ),
    path(
        "admin/users/<uuid:user_id>/unlock/",
        UserUnlockView.as_view(),
        name="admin-user-unlock",
    ),
    # Admin Analytics Endpoints
    path(
        "admin/analytics/overview/",
        analytics_overview,
        name="analytics-overview",
    ),
    path(
        "admin/analytics/by-country/",
        analytics_by_country,
        name="analytics-by-country",
    ),
    path(
        "admin/analytics/by-state/",
        analytics_by_state,
        name="analytics-by-state",
    ),
    path(
        "admin/analytics/by-age/",
        analytics_by_age,
        name="analytics-by-age",
    ),
    path(
        "admin/analytics/by-gender/",
        analytics_by_gender,
        name="analytics-by-gender",
    ),
    path(
        "admin/analytics/micro-segmentation/",
        analytics_micro_segmentation,
        name="analytics-micro-segmentation",
    ),
    path(
        "admin/analytics/top-countries/",
        analytics_top_countries,
        name="analytics-top-countries",
    ),
]
