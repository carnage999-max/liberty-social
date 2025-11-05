from rest_framework import serializers
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.contenttypes.models import ContentType
from .models import Post, Comment, Reaction, Notification, PostMedia, CommentMedia
from users.serializers import UserSerializer


class ReactionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    # accept either post or comment id
    post = serializers.PrimaryKeyRelatedField(queryset=Post.objects.all(), required=False, write_only=True)
    comment = serializers.PrimaryKeyRelatedField(queryset=Comment.objects.all(), required=False, write_only=True)

    class Meta:
        model = Reaction
        fields = ["id", "post", "comment", "user", "reaction_type", "created_at"]
        read_only_fields = ["id", "user", "created_at"]

    def create(self, validated_data):
        request = self.context.get('request')
        if request and getattr(request, 'user', None):
            user = request.user
        else:
            user = None

        post = validated_data.pop('post', None)
        comment = validated_data.pop('comment', None)

        if post is None and comment is None:
            raise serializers.ValidationError("Either 'post' or 'comment' must be provided.")
        if post is not None and comment is not None:
            raise serializers.ValidationError("Provide only one of 'post' or 'comment'.")

        if post is not None:
            content_obj = post
        else:
            content_obj = comment

        # remove existing reaction by this user on this object
        ct = ContentType.objects.get_for_model(content_obj.__class__)
        Reaction.objects.filter(content_type=ct, object_id=content_obj.id, user=user).delete()

        reaction = Reaction.objects.create(content_type=ct, object_id=content_obj.id, user=user, reaction_type=validated_data.get('reaction_type', 'like'))
        return reaction


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    media = serializers.SerializerMethodField()
    media_urls = serializers.ListField(child=serializers.URLField(), write_only=True, required=False)
    reactions = ReactionSerializer(many=True, read_only=True)
    reaction_summary = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    url_validator = URLValidator()

    class Meta:
        model = Comment
        fields = [
            "id",
            "post",
            "author",
            "content",
            "parent",
            "created_at",
            "media",
            "media_urls",
            "reactions",
            "reaction_summary",
            "replies_count",
            "user_reaction",
            "replies",
        ]
        read_only_fields = [
            "id",
            "author",
            "created_at",
            "media",
            "reactions",
            "reaction_summary",
            "replies_count",
            "user_reaction",
            "replies",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        parent = attrs.get("parent")
        post = attrs.get("post") or getattr(self.instance, "post", None)
        if parent:
            parent_post_id = parent.post_id
            if post is not None:
                current_post_id = getattr(post, "id", None) or getattr(post, "pk", None)
            elif self.instance is not None:
                current_post_id = self.instance.post_id
            else:
                current_post_id = None
            if parent_post_id != current_post_id:
                raise serializers.ValidationError({"parent": "Replies must belong to the same post."})
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        if request and getattr(request, 'user', None):
            validated_data['author'] = request.user
        media_urls = validated_data.pop('media_urls', [])
        comment = super().create(validated_data)
        for index, url in enumerate(media_urls):
            cleaned_url = url.strip() if isinstance(url, str) else str(url)
            try:
                self.url_validator(cleaned_url)
            except DjangoValidationError:
                raise serializers.ValidationError(
                    {"media_urls": [f"Invalid media URL at position {index + 1}."]}
                )
            CommentMedia.objects.create(comment=comment, url=cleaned_url)
        return comment

    def get_media(self, obj):
        return [m.url for m in obj.media.all()]

    def get_reaction_summary(self, obj):
        base = {choice[0]: 0 for choice in Reaction.TYPE_CHOICES}
        total = 0
        if hasattr(obj, "_prefetched_objects_cache") and "reactions" in obj._prefetched_objects_cache:
            reactions_iterable = obj._prefetched_objects_cache["reactions"]
        else:
            reactions_manager = getattr(obj, "reactions", None)
            if reactions_manager is not None:
                reactions_iterable = reactions_manager.all()
            else:
                reactions_iterable = Reaction.objects.filter(comment=obj).select_related("user")

        for reaction in reactions_iterable:
            base[reaction.reaction_type] = base.get(reaction.reaction_type, 0) + 1
            total += 1
        return {"total": total, "by_type": base}

    def get_replies_count(self, obj):
        if hasattr(obj, "_prefetched_objects_cache") and "replies" in obj._prefetched_objects_cache:
            return len(obj._prefetched_objects_cache["replies"])
        return obj.replies.count()

    def get_user_reaction(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        user_id = request.user.id
        if hasattr(obj, "_prefetched_objects_cache") and "reactions" in obj._prefetched_objects_cache:
            for reaction in obj._prefetched_objects_cache["reactions"]:
                if reaction.user_id == user_id:
                    return ReactionSerializer(reaction, context=self.context).data
            return None
        reaction = obj.reactions.filter(user=request.user).select_related("user").first()
        if reaction:
            return ReactionSerializer(reaction, context=self.context).data
        return None

    def get_replies(self, obj):
        depth = self.context.get("depth", 0)
        if hasattr(obj, "_prefetched_objects_cache") and "replies" in obj._prefetched_objects_cache:
            replies_qs = obj._prefetched_objects_cache["replies"]
        else:
            replies_qs = obj.replies.all()
        if not replies_qs:
            return []
        serializer = CommentSerializer(
            replies_qs,
            many=True,
            context={**self.context, "depth": depth + 1},
        )
        return serializer.data

class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    reactions = ReactionSerializer(many=True, read_only=True)
    media = serializers.SerializerMethodField()
    media_urls = serializers.ListField(child=serializers.URLField(), write_only=True, required=False)
    bookmarked = serializers.SerializerMethodField()
    bookmark_id = serializers.SerializerMethodField()
    url_validator = URLValidator()

    class Meta:
        model = Post
        fields = [
            "id",
            "author",
            "content",
            "media",
            "media_urls",
            "visibility",
            "created_at",
            "updated_at",
            "comments",
            "reactions",
            "bookmarked",
            "bookmark_id",
        ]
        read_only_fields = [
            "id",
            "author",
            "created_at",
            "updated_at",
            "comments",
            "reactions",
            "media",
            "bookmarked",
            "bookmark_id",
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        if request and getattr(request, 'user', None):
            validated_data['author'] = request.user
        media_urls = validated_data.pop('media_urls', [])
        post = super().create(validated_data)
        for index, url in enumerate(media_urls):
            cleaned_url = url.strip() if isinstance(url, str) else str(url)
            try:
                self.url_validator(cleaned_url)
            except DjangoValidationError:
                raise serializers.ValidationError(
                    {"media_urls": [f"Invalid media URL at position {index + 1}."]}
                )
            PostMedia.objects.create(post=post, url=cleaned_url)
        return post

    def get_media(self, obj):
        return [m.url for m in obj.media.all()]

    def get_bookmarked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.bookmarks.filter(user=request.user).exists()

    def get_bookmark_id(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        bookmark = obj.bookmarks.filter(user=request.user).values_list('id', flat=True).first()
        return bookmark


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    target_post_id = serializers.SerializerMethodField()
    target_post_preview = serializers.SerializerMethodField()
    target_comment_preview = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'actor', 'verb', 'content_type', 'object_id', 'unread', 'created_at', 'target_post_id', 'target_post_preview', 'target_comment_preview']
        read_only_fields = ['id', 'actor', 'verb', 'content_type', 'object_id', 'created_at', 'target_post_id', 'target_post_preview', 'target_comment_preview']

    def get_target_post_id(self, obj):
        """Get the post ID that this notification relates to"""
        if obj.content_type and obj.object_id:
            # If target is a Post, return its ID
            if obj.content_type.model == 'post':
                return obj.object_id
            # If target is a Comment, get the post from the comment
            elif obj.content_type.model == 'comment':
                try:
                    comment = obj.target
                    if comment and hasattr(comment, 'post'):
                        return comment.post.id
                except:
                    pass
        return None

    def get_target_post_preview(self, obj):
        """Get a preview of the post content (first 100 chars)"""
        post_id = self.get_target_post_id(obj)
        if post_id:
            try:
                post = Post.objects.get(id=post_id)
                if post.content:
                    preview = post.content[:100]
                    if len(post.content) > 100:
                        preview += "..."
                    return preview
            except:
                pass
        return None

    def get_target_comment_preview(self, obj):
        """Get a preview of the comment if this is a comment notification"""
        if obj.verb == 'commented' and obj.content_type and obj.content_type.model == 'post':
            # For comment notifications, we need to get the latest comment by the actor
            try:
                post = Post.objects.get(id=obj.object_id)
                comment = post.comments.filter(author=obj.actor).order_by('-created_at').first()
                if comment and comment.content:
                    preview = comment.content[:100]
                    if len(comment.content) > 100:
                        preview += "..."
                    return preview
            except:
                pass
        return None


class BookmarkSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = __import__('main.models', fromlist=['Bookmark']).Bookmark
        fields = ['id', 'user', 'post', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']
