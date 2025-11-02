from django.contrib import admin
from .models import Post, Comment, Reaction, Notification, PostMedia, Bookmark, CommentMedia


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
	list_display = ('id', 'author', 'visibility', 'created_at', 'deleted_at')
	search_fields = ('content', 'author__email', 'author__username')
	list_filter = ('visibility',)
	readonly_fields = ('created_at', 'updated_at')


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
	list_display = ('id', 'post', 'author', 'created_at')
	search_fields = ('content',)


@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
	list_display = ('id', 'reaction_type', 'user', 'created_at')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
	list_display = ('id', 'recipient', 'actor', 'verb', 'unread', 'created_at')
	list_filter = ('unread',)


@admin.register(PostMedia)
class PostMediaAdmin(admin.ModelAdmin):
	list_display = ('id', 'post', 'url')


@admin.register(CommentMedia)
class CommentMediaAdmin(admin.ModelAdmin):
	list_display = ('id', 'comment', 'url')


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
	list_display = ('id', 'user', 'post', 'created_at')
