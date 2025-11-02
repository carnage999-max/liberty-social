from rest_framework import serializers
from .models import Post, Comment, Reaction, Notification, PostMedia, CommentMedia
from users.serializers import UserSerializer
from django.contrib.contenttypes.models import ContentType


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    media = serializers.SerializerMethodField()
    media_urls = serializers.ListField(child=serializers.URLField(), write_only=True, required=False)

    class Meta:
        model = Comment
        fields = ["id", "post", "author", "content", "parent", "created_at", "media", "media_urls"]
        read_only_fields = ["id", "author", "created_at", "media"]

    def create(self, validated_data):
        request = self.context.get('request')
        if request and getattr(request, 'user', None):
            validated_data['author'] = request.user
        media_urls = validated_data.pop('media_urls', [])
        comment = super().create(validated_data)
        for url in media_urls:
            CommentMedia.objects.create(comment=comment, url=url)
        return comment

    def get_media(self, obj):
        return [m.url for m in obj.media.all()]


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


class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    reactions = ReactionSerializer(many=True, read_only=True)
    media = serializers.SerializerMethodField()
    media_urls = serializers.ListField(child=serializers.URLField(), write_only=True, required=False)

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
        ]
        read_only_fields = [
            "id",
            "author",
            "created_at",
            "updated_at",
            "comments",
            "reactions",
            "media",
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        if request and getattr(request, 'user', None):
            validated_data['author'] = request.user
        media_urls = validated_data.pop('media_urls', [])
        post = super().create(validated_data)
        for url in media_urls:
            PostMedia.objects.create(post=post, url=url)
        return post

    def get_media(self, obj):
        return [m.url for m in obj.media.all()]


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'actor', 'verb', 'content_type', 'object_id', 'unread', 'created_at']
        read_only_fields = ['id', 'actor', 'verb', 'content_type', 'object_id', 'created_at']


class BookmarkSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = __import__('main.models', fromlist=['Bookmark']).Bookmark
        fields = ['id', 'user', 'post', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']
