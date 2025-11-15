from django.contrib import admin
from .models import (
    Post,
    Comment,
    Reaction,
    Notification,
    PostMedia,
    Bookmark,
    CommentMedia,
    DeviceToken,
    Conversation,
    ConversationParticipant,
    Message,
    PageInvite,
)


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "author", "visibility", "created_at", "deleted_at")
    search_fields = ("content", "author__email", "author__username")
    list_filter = ("visibility",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "author", "created_at")
    search_fields = ("content",)


@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
    list_display = ("id", "reaction_type", "user", "created_at")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "recipient", "actor", "verb", "unread", "created_at")
    list_filter = ("unread",)


@admin.register(PostMedia)
class PostMediaAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "url")


@admin.register(CommentMedia)
class CommentMediaAdmin(admin.ModelAdmin):
    list_display = ("id", "comment", "url")


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "post", "created_at")


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "platform", "last_seen_at")
    search_fields = ("user__email", "user__username", "token")
    list_filter = ("platform",)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "is_group", "created_by", "last_message_at")
    search_fields = (
        "title",
        "participants__user__username",
        "participants__user__email",
    )
    list_filter = ("is_group",)
    autocomplete_fields = ("created_by",)


@admin.register(ConversationParticipant)
class ConversationParticipantAdmin(admin.ModelAdmin):
    list_display = ("conversation", "user", "role", "joined_at", "last_read_at")
    search_fields = ("conversation__title", "user__username", "user__email")
    autocomplete_fields = ("conversation", "user")
    list_filter = ("role",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender", "created_at", "is_deleted")
    search_fields = ("content", "sender__username", "sender__email")
    autocomplete_fields = ("conversation", "sender", "reply_to")


@admin.register(PageInvite)
class PageInviteAdmin(admin.ModelAdmin):
    list_display = ("id", "page", "sender", "recipient", "status", "created_at")
    search_fields = (
        "page__name",
        "sender__username",
        "recipient__username",
        "sender__email",
        "recipient__email",
    )
    list_filter = ("status", "created_at")
    readonly_fields = ("created_at", "responded_at")
