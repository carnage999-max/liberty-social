from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericRelation

from .slug_utils import normalize_post_title, unique_slugify

class Post(models.Model):
    VISIBILITY = (
        ("public", "public"),
        ("friends", "friends"),
        ("only_me", "only_me"),
    )
    AUTHOR_TYPE_CHOICES = (
        ("user", "user"),
        ("page", "page"),
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts"
    )
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    content = models.TextField()
    media_url = models.URLField(blank=True, null=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    visibility = models.CharField(max_length=10, choices=VISIBILITY, default="public")
    author_type = models.CharField(
        max_length=10, choices=AUTHOR_TYPE_CHOICES, default="user"
    )
    page = models.ForeignKey(
        "main.Page",
        on_delete=models.CASCADE,
        related_name="posts",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reactions = GenericRelation("main.Reaction", related_query_name="post")

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        if self.author_type == "page" and not self.page_id:
            raise ValueError("Page-authored posts must reference a page.")
        if self.author_type == "user" and self.page_id:
            raise ValueError("User-authored posts cannot reference a page.")

    def save(self, *args, **kwargs):
        if not self.slug:
            source = normalize_post_title(self.content)
            self.slug = unique_slugify(self.__class__, source, fallback="post")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Post {self.id} ({self.author_type})"


class Comment(models.Model):
    post = models.ForeignKey(
        "main.Post", on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    content = models.TextField()
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reactions = GenericRelation("main.Reaction", related_query_name="comment")

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment {self.id} by {self.author} on Post {self.post_id}"


class CommentMedia(models.Model):
    comment = models.ForeignKey(
        "main.Comment", on_delete=models.CASCADE, related_name="media"
    )
    url = models.URLField()
    content_type = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f"Media for comment {self.comment_id}: {self.url}"


class PostMedia(models.Model):
    post = models.ForeignKey(
        "main.Post", on_delete=models.CASCADE, related_name="media"
    )
    url = models.URLField()
    content_type = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f"Media for post {self.post_id}: {self.url}"


class Bookmark(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookmarks"
    )
    post = models.ForeignKey(
        "main.Post", on_delete=models.CASCADE, related_name="bookmarks"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("user", "post"),)

    def __str__(self):
        return f"{self.user} bookmarked {self.post_id}"


class SaveFolder(models.Model):
    """Folders for organizing saved posts."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="save_folders"
    )
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = (("user", "name"),)
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user} - {self.name}"


class SaveFolderItem(models.Model):
    """Items (posts) saved in a folder."""
    folder = models.ForeignKey(
        SaveFolder, on_delete=models.CASCADE, related_name="items"
    )
    post = models.ForeignKey(
        "main.Post", on_delete=models.CASCADE, related_name="save_folder_items"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("folder", "post"),)
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.folder.name} - {self.post_id}"


from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class Reaction(models.Model):
    # Legacy TYPE_CHOICES kept for compatibility (not enforced in model anymore)
    TYPE_CHOICES = (
        ("like", "like"),
        ("love", "love"),
        ("haha", "haha"),
        ("sad", "sad"),
        ("angry", "angry"),
    )

    # generic relation to Post or Comment (or future types)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.BigIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reactions"
    )
    # Changed to support any emoji (max 10 chars to support multi-codepoint emojis)
    reaction_type = models.CharField(max_length=10, default="👍")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("content_type", "object_id", "user"),)
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.reaction_type} by {self.user} on {self.content_type} {self.object_id}"


class Notification(models.Model):
    """Simple notification model: recipient is notified of actor/verb on a target object."""

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+"
    )
    verb = models.CharField(max_length=50)
    # optional target (post/comment/other)
    content_type = models.ForeignKey(
        ContentType, null=True, blank=True, on_delete=models.CASCADE
    )
    object_id = models.BigIntegerField(null=True, blank=True)
    target = GenericForeignKey("content_type", "object_id")
    unread = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification to {self.recipient} - {self.actor} {self.verb}"


class DeviceToken(models.Model):
    PLATFORM_CHOICES = (
        ("ios", "iOS"),
        ("android", "Android"),
        ("web", "Web"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="device_tokens",
    )
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=10, choices=PLATFORM_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_seen_at"]

    def __str__(self):
        return f"DeviceToken({self.user_id}, {self.platform})"


class Conversation(models.Model):
    """Represents a direct or group chat."""

    id = models.BigAutoField(primary_key=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    is_group = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="conversations_created",
        on_delete=models.CASCADE,
    )
    last_message_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-last_message_at", "-updated_at"]

    def __str__(self):
        if self.title:
            return self.title
        return f"Conversation {self.id}"


class ConversationParticipant(models.Model):
    """Links users to conversations and tracks read state."""

    ROLE_CHOICES = (
        ("member", "Member"),
        ("admin", "Admin"),
    )

    conversation = models.ForeignKey(
        Conversation, related_name="participants", on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="conversation_memberships",
        on_delete=models.CASCADE,
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="member")
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(blank=True, null=True)
    is_archived = models.BooleanField(default=False)

    class Meta:
        unique_together = ("conversation", "user")
        ordering = ["-joined_at"]

    def __str__(self):
        return f"{self.user} in {self.conversation_id}"


class Message(models.Model):
    """Individual messages inside a conversation."""

    id = models.BigAutoField(primary_key=True)
    conversation = models.ForeignKey(
        Conversation, related_name="messages", on_delete=models.CASCADE
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="messages_sent",
        on_delete=models.CASCADE,
    )
    content = models.TextField(blank=True)
    media_url = models.URLField(blank=True, null=True)
    reply_to = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="replies"
    )
    is_deleted = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    reactions = GenericRelation("main.Reaction", related_query_name="message")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "-created_at"]),
            models.Index(fields=["sender", "-created_at"]),
        ]

    def __str__(self):
        return f"Message {self.id} in {self.conversation_id}"


class Call(models.Model):
    """Voice and video calls between users."""

    CALL_TYPE_CHOICES = (
        ("voice", "Voice"),
        ("video", "Video"),
    )

    STATUS_CHOICES = (
        ("initiating", "Initiating"),
        ("ringing", "Ringing"),
        ("active", "Active"),
        ("ended", "Ended"),
        ("missed", "Missed"),
        ("rejected", "Rejected"),
        ("cancelled", "Cancelled"),
    )

    id = models.BigAutoField(primary_key=True)
    conversation = models.ForeignKey(
        Conversation,
        related_name="calls",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Optional: Link call to a conversation",
    )
    caller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="calls_initiated",
        on_delete=models.CASCADE,
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="calls_received",
        on_delete=models.CASCADE,
    )
    call_type = models.CharField(
        max_length=10, choices=CALL_TYPE_CHOICES, default="voice"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="initiating"
    )
    started_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(
        default=0, help_text="Call duration in seconds"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["caller", "-started_at"]),
            models.Index(fields=["receiver", "-started_at"]),
            models.Index(fields=["status", "-started_at"]),
        ]

    def __str__(self):
        return f"Call {self.id}: {self.caller.username} -> {self.receiver.username} ({self.call_type})"

    def end_call(self, duration_seconds=0):
        """Mark call as ended and set duration."""
        from django.utils import timezone

        self.status = "ended"
        self.ended_at = timezone.now()
        self.duration_seconds = duration_seconds
        self.save()


class Page(models.Model):
    CATEGORY_CHOICES = (
        ("business", "Business"),
        ("community", "Community"),
        ("brand", "Brand"),
        ("news", "News"),
        ("restaurant", "Restaurant"),
        ("entertainment", "Entertainment"),
        ("hobbies", "Hobbies"),
        ("work", "Work"),
        ("associates", "Associates"),
        ("sports", "Sports"),
        ("music", "Music"),
        ("art", "Art"),
        ("tech", "Technology"),
        ("lifestyle", "Lifestyle"),
        ("education", "Education"),
        ("health", "Health & Wellness"),
        ("travel", "Travel"),
        ("food", "Food & Cooking"),
        ("fashion", "Fashion"),
        ("games", "Games"),
        ("other", "Other"),
    )

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True)
    category = models.CharField(
        max_length=50, choices=CATEGORY_CHOICES, default="other"
    )
    website_url = models.URLField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    profile_image_url = models.URLField(blank=True, null=True)
    cover_image_url = models.URLField(blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="pages_created",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slugify(self.__class__, self.name, fallback="page")
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class PageAdmin(models.Model):
    ROLE_CHOICES = (
        ("owner", "owner"),
        ("admin", "admin"),
        ("editor", "editor"),
        ("moderator", "moderator"),
    )

    page = models.ForeignKey(Page, related_name="admins", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="page_admin_roles",
        on_delete=models.CASCADE,
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="admin")
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="page_admins_added",
        on_delete=models.CASCADE,
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("page", "user")
        ordering = ["-added_at"]

    def __str__(self):
        return f"{self.user} as {self.role} on {self.page}"


class PageAdminInvite(models.Model):
    STATUS_CHOICES = (
        ("pending", "pending"),
        ("accepted", "accepted"),
        ("declined", "declined"),
        ("cancelled", "cancelled"),
    )

    ROLE_CHOICES = tuple(
        choice for choice in PageAdmin.ROLE_CHOICES if choice[0] != "owner"
    )

    page = models.ForeignKey(
        Page, related_name="admin_invites", on_delete=models.CASCADE
    )
    inviter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="page_admin_invites_sent",
        on_delete=models.CASCADE,
    )
    invitee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="page_admin_invites",
        on_delete=models.CASCADE,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="admin")
    invited_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["page", "invitee"],
                condition=models.Q(status="pending"),
                name="unique_pending_invite_per_user",
            )
        ]
        ordering = ["-invited_at"]

    def __str__(self):
        return f"Invite {self.page} -> {self.invitee} ({self.status})"


class PageFollower(models.Model):
    page = models.ForeignKey(Page, related_name="followers", on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="followed_pages",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("page", "user")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} follows {self.page}"


class PageInvite(models.Model):
    STATUS_CHOICES = (
        ("pending", "pending"),
        ("accepted", "accepted"),
        ("declined", "declined"),
    )

    page = models.ForeignKey(Page, related_name="invites", on_delete=models.CASCADE)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="page_invites_sent",
        on_delete=models.CASCADE,
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="page_invites_received",
        on_delete=models.CASCADE,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["page", "recipient"],
                condition=models.Q(status="pending"),
                name="unique_pending_page_invite_per_user",
            )
        ]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["page", "status"]),
            models.Index(fields=["recipient", "status"]),
        ]

    def __str__(self):
        return f"PageInvite: {self.sender} -> {self.recipient} for {self.page} ({self.status})"


class UserFeedPreference(models.Model):
    """User's preferences for feed filtering and content types"""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feed_preference",
    )
    # Content type filters
    show_friend_posts = models.BooleanField(default=True)
    show_page_posts = models.BooleanField(default=True)

    # Preferred page categories (JSON field storing list of category codes)
    preferred_categories = models.JSONField(
        default=list,
        blank=True,
        help_text="List of preferred page categories for filtering",
    )

    # Whether to show posts from categories not in preferred_categories
    show_other_categories = models.BooleanField(
        default=True, help_text="Show posts from categories not in preferred list"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "User Feed Preferences"

    def __str__(self):
        return f"Feed preferences for {self.user}"


class UserReactionPreference(models.Model):
    """Track user's favorite and recently used emojis for reactions"""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reaction_preference",
    )

    # Favorite emojis (manually marked as favorites by user) - up to 10 emojis
    favorite_emojis = models.JSONField(
        default=list,
        blank=True,
        help_text="List of favorite emoji strings (up to 10)",
    )

    # Recently used emojis (automatically tracked) - up to 10 emojis in order of recency
    recent_emojis = models.JSONField(
        default=list,
        blank=True,
        help_text="List of recently used emoji strings (up to 10, ordered by recency)",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "User Reaction Preferences"

    def add_recent_emoji(self, emoji: str):
        """Add an emoji to recent list, keeping only the 10 most recent"""
        recents = list(self.recent_emojis) if self.recent_emojis else []

        # Remove if already in list (so we can add it to the front)
        if emoji in recents:
            recents.remove(emoji)

        # Add to front
        recents.insert(0, emoji)

        # Keep only 10 most recent
        self.recent_emojis = recents[:10]
        self.save(update_fields=["recent_emojis", "updated_at"])

    def toggle_favorite_emoji(self, emoji: str):
        """Add or remove emoji from favorites"""
        favorites = list(self.favorite_emojis) if self.favorite_emojis else []

        if emoji in favorites:
            favorites.remove(emoji)
        else:
            # Only allow up to 10 favorites
            if len(favorites) < 10:
                favorites.append(emoji)

        self.favorite_emojis = favorites
        self.save(update_fields=["favorite_emojis", "updated_at"])

    def __str__(self):
        return f"Reaction preferences for {self.user}"


# Import marketplace models
from .marketplace_models import (
    MarketplaceCategory,
    MarketplaceListing,
    MarketplaceListingMedia,
    MarketplaceSave,
    MarketplaceReport,
    MarketplaceOffer,
    SellerVerification,
)

# Import animal marketplace models
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

# Import yard sale models
from .yard_sale_models import (
    YardSaleListing,
    YardSaleReport,
)
