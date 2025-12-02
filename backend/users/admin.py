from django.contrib import admin
from .models import (
    User,
    UserSettings,
    FriendRequest,
    Friends,
    BlockedUsers,
    DismissedSuggestion,
    AccountDeletionRequest,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "username", "is_staff", "is_superuser")
    search_fields = ("email", "username")
    readonly_fields = ("id",)


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "profile_privacy", "friends_publicity")


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    list_display = ("from_user", "to_user", "status", "created_at")
    list_filter = ("status",)


@admin.register(Friends)
class FriendsAdmin(admin.ModelAdmin):
    list_display = ("user", "friend", "created_at")


@admin.register(BlockedUsers)
class BlockedUsersAdmin(admin.ModelAdmin):
    list_display = ("user", "blocked_user", "created_at")


@admin.register(DismissedSuggestion)
class DismissedSuggestionAdmin(admin.ModelAdmin):
    list_display = ("user", "dismissed_user", "created_at")


@admin.register(AccountDeletionRequest)
class AccountDeletionRequestAdmin(admin.ModelAdmin):
    list_display = ("user", "requested_at", "is_processed", "processed_at")
    list_filter = ("is_processed",)
    search_fields = ("user__email", "user__username")
    readonly_fields = ("requested_at",)
