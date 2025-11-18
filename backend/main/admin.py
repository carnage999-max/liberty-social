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
    UserFeedPreference,
)
from .animal_models import (
    AnimalCategory,
    AnimalSellerVerification,
    VetDocumentation,
    AnimalListing,
    AnimalListingMedia,
    SellerReview,
    SuspiciousActivityLog,
    BreederDirectory,
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


@admin.register(UserFeedPreference)
class UserFeedPreferenceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "show_friend_posts",
        "show_page_posts",
        "show_other_categories",
        "created_at",
    )
    search_fields = ("user__username", "user__email")
    list_filter = ("show_friend_posts", "show_page_posts", "show_other_categories")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("User", {"fields": ("user",)}),
        ("Post Type Filtering", {"fields": ("show_friend_posts", "show_page_posts")}),
        (
            "Category Preferences",
            {"fields": ("preferred_categories", "show_other_categories")},
        ),
        (
            "Timestamps",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )


# Animal Marketplace Admin


@admin.register(AnimalCategory)
class AnimalCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Basic Info", {"fields": ("name", "description")}),
        ("State Restrictions", {"fields": ("state_restrictions",)}),
        (
            "Timestamps",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )


@admin.register(AnimalSellerVerification)
class AnimalSellerVerificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "created_at")
    search_fields = ("user__username", "user__email", "full_name")
    list_filter = ("status", "created_at")
    readonly_fields = ("created_at", "updated_at", "verified_at")


@admin.register(VetDocumentation)
class VetDocumentationAdmin(admin.ModelAdmin):
    list_display = ("id", "listing")
    readonly_fields = ("created_at",)
    fieldsets = (
        ("Listing", {"fields": ("animal_listing",)}),
        (
            "Veterinarian Info",
            {
                "fields": (
                    "vet_clinic_name",
                    "vet_license_number",
                    "vet_contact_email",
                )
            },
        ),
        (
            "Health Records",
            {
                "fields": (
                    "date_of_check",
                    "health_check_status",
                    "health_notes",
                    "vaccination_status",
                    "vaccination_records_url",
                )
            },
        ),
        (
            "Timestamps",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )


@admin.register(AnimalListing)
class AnimalListingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "seller",
        "category",
        "price",
        "status",
        "created_at",
    )
    search_fields = ("title", "seller__username", "seller__email", "description")
    list_filter = ("status", "category", "created_at")
    readonly_fields = ("created_at", "updated_at", "views_count", "legal_check_date")


@admin.register(AnimalListingMedia)
class AnimalListingMediaAdmin(admin.ModelAdmin):
    list_display = ("id", "listing")
    list_filter = ("media_type",)


@admin.register(SellerReview)
class SellerReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "rating", "created_at")
    list_filter = ("rating", "created_at")
    readonly_fields = ("created_at",)


@admin.register(SuspiciousActivityLog)
class SuspiciousActivityLogAdmin(admin.ModelAdmin):
    list_display = ("id", "activity_type")
    list_filter = ("activity_type",)
    readonly_fields = ("detected_at",)


@admin.register(BreederDirectory)
class BreederDirectoryAdmin(admin.ModelAdmin):
    list_display = ("id", "seller", "created_at")
    search_fields = ("seller__username", "seller__email")
    list_filter = ("created_at",)
    readonly_fields = ("created_at", "updated_at")
