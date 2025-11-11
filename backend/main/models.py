from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericRelation


class Post(models.Model):
	VISIBILITY = (
		("public", "public"),
		("friends", "friends"),
		("only_me", "only_me"),
	)

	author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
	content = models.TextField()
	media_url = models.URLField(blank=True, null=True)
	edited_at = models.DateTimeField(null=True, blank=True)
	deleted_at = models.DateTimeField(null=True, blank=True)
	visibility = models.CharField(max_length=10, choices=VISIBILITY, default='public')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)
	reactions = GenericRelation('main.Reaction', related_query_name='post')

	class Meta:
		ordering = ['-created_at']

	def __str__(self):
		return f"Post {self.id} by {self.author}"


class Comment(models.Model):
	post = models.ForeignKey('main.Post', on_delete=models.CASCADE, related_name='comments')
	author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments')
	content = models.TextField()
	parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
	created_at = models.DateTimeField(auto_now_add=True)
	reactions = GenericRelation('main.Reaction', related_query_name='comment')
	class Meta:
		ordering = ['created_at']

	def __str__(self):
		return f"Comment {self.id} by {self.author} on Post {self.post_id}"


class CommentMedia(models.Model):
	comment = models.ForeignKey('main.Comment', on_delete=models.CASCADE, related_name='media')
	url = models.URLField()
	content_type = models.CharField(max_length=50, blank=True, null=True)

	def __str__(self):
		return f"Media for comment {self.comment_id}: {self.url}"


class PostMedia(models.Model):
	post = models.ForeignKey('main.Post', on_delete=models.CASCADE, related_name='media')
	url = models.URLField()
	content_type = models.CharField(max_length=50, blank=True, null=True)

	def __str__(self):
		return f"Media for post {self.post_id}: {self.url}"


class Bookmark(models.Model):
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookmarks')
	post = models.ForeignKey('main.Post', on_delete=models.CASCADE, related_name='bookmarks')
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = (('user', 'post'),)

	def __str__(self):
		return f"{self.user} bookmarked {self.post_id}"


from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class Reaction(models.Model):
	TYPE_CHOICES = (
		('like', 'like'),
		('love', 'love'),
		('haha', 'haha'),
		('sad', 'sad'),
		('angry', 'angry'),
	)

	# generic relation to Post or Comment (or future types)
	content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
	object_id = models.BigIntegerField()
	content_object = GenericForeignKey('content_type', 'object_id')

	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reactions')
	reaction_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='like')
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = (('content_type', 'object_id', 'user'),)

	def __str__(self):
		return f"{self.reaction_type} by {self.user} on {self.content_type} {self.object_id}"


class Notification(models.Model):
	"""Simple notification model: recipient is notified of actor/verb on a target object."""
	recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
	actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
	verb = models.CharField(max_length=50)
	# optional target (post/comment/other)
	content_type = models.ForeignKey(ContentType, null=True, blank=True, on_delete=models.CASCADE)
	object_id = models.BigIntegerField(null=True, blank=True)
	target = GenericForeignKey('content_type', 'object_id')
	unread = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']

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
    reactions = GenericRelation('main.Reaction', related_query_name='message')
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
