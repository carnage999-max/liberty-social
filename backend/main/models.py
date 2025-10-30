from django.db import models
from django.conf import settings


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
	class Meta:
		ordering = ['created_at']

	def __str__(self):
		return f"Comment {self.id} by {self.author} on Post {self.post_id}"


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
