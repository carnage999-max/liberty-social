from rest_framework import serializers
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from django.contrib.auth import get_user_model

from .models import (
    Post,
    Comment,
    Reaction,
    Notification,
    PostMedia,
    CommentMedia,
    DeviceToken,
    Conversation,
    ConversationParticipant,
    Message,
    Page,
    PageAdmin,
    PageAdminInvite,
    PageFollower,
    PageInvite,
    UserFeedPreference,
)
from users.serializers import UserSerializer


class ReactionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    # accept either post, comment, or message id
    post = serializers.PrimaryKeyRelatedField(
        queryset=Post.objects.all(), required=False, write_only=True
    )
    comment = serializers.PrimaryKeyRelatedField(
        queryset=Comment.objects.all(), required=False, write_only=True
    )
    message = serializers.PrimaryKeyRelatedField(
        queryset=Message.objects.all(), required=False, write_only=True
    )

    class Meta:
        model = Reaction
        fields = [
            "id",
            "post",
            "comment",
            "message",
            "user",
            "reaction_type",
            "created_at",
        ]
        read_only_fields = ["id", "user", "created_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        if request and getattr(request, "user", None):
            user = request.user
        else:
            user = None

        post = validated_data.pop("post", None)
        comment = validated_data.pop("comment", None)
        message = validated_data.pop("message", None)

        provided = [x for x in [post, comment, message] if x is not None]
        if len(provided) == 0:
            raise serializers.ValidationError(
                "Either 'post', 'comment', or 'message' must be provided."
            )
        if len(provided) > 1:
            raise serializers.ValidationError(
                "Provide only one of 'post', 'comment', or 'message'."
            )

        if post is not None:
            content_obj = post
        elif comment is not None:
            content_obj = comment
        else:
            content_obj = message

        # remove existing reaction by this user on this object
        ct = ContentType.objects.get_for_model(content_obj.__class__)
        Reaction.objects.filter(
            content_type=ct, object_id=content_obj.id, user=user
        ).delete()

        reaction = Reaction.objects.create(
            content_type=ct,
            object_id=content_obj.id,
            user=user,
            reaction_type=validated_data.get("reaction_type", "like"),
        )
        return reaction


class PageSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Page
        fields = [
            "id",
            "name",
            "category",
            "profile_image_url",
            "cover_image_url",
            "is_verified",
        ]


class PageSerializer(PageSummarySerializer):
    created_by = UserSerializer(read_only=True)
    follower_count = serializers.SerializerMethodField()
    admin_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()

    def validate_website_url(self, value):
        """Ensure website URL has a protocol. If not, prepend https://"""
        if not value:
            return value

        value = value.strip()
        if not value:
            return None

        # Check if URL already has a protocol
        if not value.startswith(("http://", "https://")):
            # Prepend https://
            value = f"https://{value}"

        return value

    class Meta(PageSummarySerializer.Meta):
        model = Page
        fields = PageSummarySerializer.Meta.fields + [
            "description",
            "website_url",
            "phone",
            "email",
            "is_active",
            "created_by",
            "created_at",
            "updated_at",
            "follower_count",
            "admin_count",
            "is_following",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_at",
            "updated_at",
            "follower_count",
            "admin_count",
            "is_verified",
            "is_following",
        ]

    def get_request_user(self):
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            return request.user
        return None

    def get_follower_count(self, obj):
        return getattr(obj, "_followers_count", None) or obj.followers.count()

    def get_admin_count(self, obj):
        return getattr(obj, "_admins_count", None) or obj.admins.count()

    def get_is_following(self, obj):
        user = self.get_request_user()
        if not user or not user.is_authenticated:
            return False
        if (
            hasattr(obj, "_prefetched_objects_cache")
            and "followers" in obj._prefetched_objects_cache
        ):
            return any(
                follower.user_id == user.id
                for follower in obj._prefetched_objects_cache["followers"]
            )
        return obj.followers.filter(user=user).exists()


class PageAdminSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    added_by = UserSerializer(read_only=True)

    class Meta:
        model = PageAdmin
        fields = ["id", "page", "user", "role", "added_by", "added_at"]
        read_only_fields = ["id", "page", "user", "added_by", "added_at"]


class PageAdminInviteSerializer(serializers.ModelSerializer):
    page = PageSummarySerializer(read_only=True)
    inviter = UserSerializer(read_only=True)
    invitee = UserSerializer(read_only=True)

    class Meta:
        model = PageAdminInvite
        fields = [
            "id",
            "page",
            "inviter",
            "invitee",
            "role",
            "status",
            "invited_at",
            "responded_at",
        ]
        read_only_fields = fields


class PageFollowerSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = PageFollower
        fields = ["id", "page", "user", "created_at"]
        read_only_fields = fields


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    media = serializers.SerializerMethodField()
    media_urls = serializers.ListField(
        child=serializers.URLField(), write_only=True, required=False
    )
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
                raise serializers.ValidationError(
                    {"parent": "Replies must belong to the same post."}
                )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and getattr(request, "user", None):
            validated_data["author"] = request.user
        media_urls = validated_data.pop("media_urls", [])
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
        if (
            hasattr(obj, "_prefetched_objects_cache")
            and "reactions" in obj._prefetched_objects_cache
        ):
            reactions_iterable = obj._prefetched_objects_cache["reactions"]
        else:
            reactions_manager = getattr(obj, "reactions", None)
            if reactions_manager is not None:
                reactions_iterable = reactions_manager.all()
            else:
                reactions_iterable = Reaction.objects.filter(
                    comment=obj
                ).select_related("user")

        for reaction in reactions_iterable:
            base[reaction.reaction_type] = base.get(reaction.reaction_type, 0) + 1
            total += 1
        return {"total": total, "by_type": base}

    def get_replies_count(self, obj):
        if (
            hasattr(obj, "_prefetched_objects_cache")
            and "replies" in obj._prefetched_objects_cache
        ):
            return len(obj._prefetched_objects_cache["replies"])
        return obj.replies.count()

    def get_user_reaction(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        user_id = request.user.id
        if (
            hasattr(obj, "_prefetched_objects_cache")
            and "reactions" in obj._prefetched_objects_cache
        ):
            for reaction in obj._prefetched_objects_cache["reactions"]:
                if reaction.user_id == user_id:
                    return ReactionSerializer(reaction, context=self.context).data
            return None
        reaction = (
            obj.reactions.filter(user=request.user).select_related("user").first()
        )
        if reaction:
            return ReactionSerializer(reaction, context=self.context).data
        return None

    def get_replies(self, obj):
        depth = self.context.get("depth", 0)
        if (
            hasattr(obj, "_prefetched_objects_cache")
            and "replies" in obj._prefetched_objects_cache
        ):
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
    page = PageSummarySerializer(read_only=True)
    page_id = serializers.PrimaryKeyRelatedField(
        queryset=Page.objects.filter(is_active=True),
        required=False,
        allow_null=True,
        write_only=True,
        source="page",
    )
    author_type = serializers.CharField(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    reactions = ReactionSerializer(many=True, read_only=True)
    media = serializers.SerializerMethodField()
    media_urls = serializers.ListField(
        child=serializers.URLField(), write_only=True, required=False
    )
    bookmarked = serializers.SerializerMethodField()
    bookmark_id = serializers.SerializerMethodField()
    url_validator = URLValidator()

    class Meta:
        model = Post
        fields = [
            "id",
            "author",
            "author_type",
            "page",
            "page_id",
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
            "author_type",
            "page",
            "created_at",
            "updated_at",
            "comments",
            "reactions",
            "media",
            "bookmarked",
            "bookmark_id",
        ]

    def create(self, validated_data):
        request = self.context.get("request")
        if request and getattr(request, "user", None):
            validated_data["author"] = request.user
        page = validated_data.get("page")
        validated_data["author_type"] = "page" if page else "user"
        media_urls = validated_data.pop("media_urls", [])
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
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.bookmarks.filter(user=request.user).exists()

    def get_bookmark_id(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        bookmark = (
            obj.bookmarks.filter(user=request.user).values_list("id", flat=True).first()
        )
        return bookmark


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    target_post_id = serializers.SerializerMethodField()
    target_post_preview = serializers.SerializerMethodField()
    target_comment_preview = serializers.SerializerMethodField()
    target_url = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "actor",
            "verb",
            "content_type",
            "object_id",
            "unread",
            "created_at",
            "target_post_id",
            "target_post_preview",
            "target_comment_preview",
            "target_url",
        ]
        read_only_fields = [
            "id",
            "actor",
            "verb",
            "content_type",
            "object_id",
            "created_at",
            "target_post_id",
            "target_post_preview",
            "target_comment_preview",
            "target_url",
        ]

    def get_target_post_id(self, obj):
        """Get the post ID that this notification relates to"""
        if obj.content_type and obj.object_id:
            # If target is a Post, return its ID
            if obj.content_type.model == "post":
                return obj.object_id
            # If target is a Comment, get the post from the comment
            elif obj.content_type.model == "comment":
                try:
                    comment = obj.target
                    if comment and hasattr(comment, "post"):
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
        """Get a preview of the comment if this is a comment or reply notification"""
        try:
            if obj.content_type and obj.content_type.model == "comment":
                comment = obj.target
                if comment and getattr(comment, "content", None):
                    preview = comment.content[:100]
                    if len(comment.content) > 100:
                        preview += "..."
                    return preview

            if (
                obj.verb == "commented"
                and obj.content_type
                and obj.content_type.model == "post"
            ):
                post = Post.objects.get(id=obj.object_id)
                comment = (
                    post.comments.filter(author=obj.actor)
                    .order_by("-created_at")
                    .first()
                )
                if comment and comment.content:
                    preview = comment.content[:100]
                    if len(comment.content) > 100:
                        preview += "..."
                    return preview
        except Exception:
            pass
        return None

    def get_target_url(self, obj):
        """Get the URL to navigate to when clicking the notification"""
        try:
            if obj.content_type and obj.object_id:
                # If target is a Post, link to the post
                if obj.content_type.model == "post":
                    return f"/app/feed/{obj.object_id}"
                # If target is a Comment, link to the post with the comment
                elif obj.content_type.model == "comment":
                    comment = obj.target
                    if comment and hasattr(comment, "post"):
                        return f"/app/feed/{comment.post.id}"
                # If target is a FriendRequest, link to friend requests
                elif obj.content_type.model == "friendrequest":
                    return "/app/friend-requests"
                # If target is a Conversation, link to the conversation
                elif obj.content_type.model == "conversation":
                    return f"/app/messages/{obj.object_id}"
        except Exception:
            pass
        # Default to notifications page
        return "/app/notifications"


class BookmarkSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = __import__("main.models", fromlist=["Bookmark"]).Bookmark
        fields = ["id", "user", "post", "created_at"]
        read_only_fields = ["id", "user", "created_at"]


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ["id", "token", "platform", "created_at", "last_seen_at"]
        read_only_fields = ["id", "created_at", "last_seen_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        token = validated_data["token"]
        platform = validated_data["platform"]
        user = request.user

        device, created = DeviceToken.objects.get_or_create(
            token=token,
            defaults={"user": user, "platform": platform},
        )
        if not created:
            device.user = user
            device.platform = platform
            device.last_seen_at = timezone.now()
            device.save(update_fields=["user", "platform", "last_seen_at"])
        return device


class ConversationParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ConversationParticipant
        fields = ["id", "user", "role", "joined_at", "last_read_at"]
        read_only_fields = fields


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    reply_to = serializers.PrimaryKeyRelatedField(
        queryset=Message.objects.all(), allow_null=True, required=False
    )
    reactions = ReactionSerializer(many=True, read_only=True)
    reaction_summary = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "content",
            "media_url",
            "reply_to",
            "is_deleted",
            "edited_at",
            "reactions",
            "reaction_summary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "conversation",
            "sender",
            "is_deleted",
            "created_at",
            "updated_at",
        ]

    def get_reaction_summary(self, obj):
        try:
            base = {choice[0]: 0 for choice in Reaction.TYPE_CHOICES}
            total = 0
            if (
                hasattr(obj, "_prefetched_objects_cache")
                and "reactions" in obj._prefetched_objects_cache
            ):
                reactions_iterable = obj._prefetched_objects_cache["reactions"]
            else:
                reactions_manager = getattr(obj, "reactions", None)
                if reactions_manager is not None:
                    reactions_iterable = reactions_manager.all()
                else:
                    reactions_iterable = Reaction.objects.filter(
                        content_type=ContentType.objects.get_for_model(Message),
                        object_id=obj.id,
                    ).select_related("user")
            for reaction in reactions_iterable:
                if reaction.reaction_type in base:
                    base[reaction.reaction_type] += 1
                    total += 1
            return {"total": total, "by_type": base}
        except Exception as e:
            # Return empty summary if there's an error
            import logging

            logger = logging.getLogger(__name__)
            logger.error(
                f"Error getting reaction summary for message {obj.id}: {str(e)}"
            )
            return {
                "total": 0,
                "by_type": {choice[0]: 0 for choice in Reaction.TYPE_CHOICES},
            }


class ConversationSerializer(serializers.ModelSerializer):
    participants = ConversationParticipantSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    last_message = serializers.SerializerMethodField()
    participant_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        help_text="UUIDs of users to add to the conversation (excluding yourself).",
    )

    class Meta:
        model = Conversation
        fields = [
            "id",
            "title",
            "is_group",
            "created_by",
            "created_at",
            "updated_at",
            "last_message_at",
            "participants",
            "last_message",
            "participant_ids",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_at",
            "updated_at",
            "last_message_at",
            "participants",
            "last_message",
        ]

    def validate_participant_ids(self, value):
        ids = [str(v) for v in value if v]
        if not ids:
            return ids
        User = get_user_model()
        found = set(
            str(u) for u in User.objects.filter(id__in=ids).values_list("id", flat=True)
        )
        missing = set(ids) - found
        if missing:
            raise serializers.ValidationError(f"Unknown user IDs: {', '.join(missing)}")
        return ids

    def create(self, validated_data):
        participant_ids = validated_data.pop("participant_ids", [])
        request = self.context.get("request")
        creator = request.user if request else None
        is_group = validated_data.get("is_group", False)
        total_participants = set(participant_ids)
        if creator:
            total_participants.add(str(creator.id))
        if not is_group and len(total_participants) != 2:
            raise serializers.ValidationError(
                "Direct conversations must include exactly two participants."
            )
        # Remove created_by from validated_data if it exists to avoid duplicate
        validated_data.pop("created_by", None)
        conversation = Conversation.objects.create(created_by=creator, **validated_data)

        participant_ids = set(participant_ids)
        if creator:
            participant_ids.add(str(creator.id))

        User = get_user_model()
        users = User.objects.filter(id__in=participant_ids)
        batch = [
            ConversationParticipant(
                conversation=conversation,
                user=user,
                role="admin" if creator and user.id == creator.id else "member",
            )
            for user in users
        ]
        ConversationParticipant.objects.bulk_create(batch, ignore_conflicts=True)
        return conversation

    def get_last_message(self, obj):
        message = (
            getattr(obj, "messages", None)
            and obj.messages.order_by("-created_at").select_related("sender").first()
        )
        if not message:
            return None
        return MessageSerializer(message, context=self.context).data


# Marketplace Serializers
class MarketplaceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__(
            "main.marketplace_models", fromlist=["MarketplaceCategory"]
        ).MarketplaceCategory
        fields = ["id", "name", "slug", "description", "icon_url", "is_active"]
        read_only_fields = ["id"]


class MarketplaceListingMediaSerializer(serializers.ModelSerializer):
    listing_id = serializers.PrimaryKeyRelatedField(
        queryset=__import__(
            "main.marketplace_models", fromlist=["MarketplaceListing"]
        ).MarketplaceListing.objects.all(),
        source="listing",
        write_only=True,
    )

    class Meta:
        model = __import__(
            "main.marketplace_models", fromlist=["MarketplaceListingMedia"]
        ).MarketplaceListingMedia
        fields = ["id", "url", "content_type", "order", "uploaded_at", "listing_id"]
        read_only_fields = ["id", "uploaded_at"]


class MarketplaceListingSerializer(serializers.ModelSerializer):
    seller = UserSerializer(read_only=True)
    category = MarketplaceCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=__import__(
            "main.marketplace_models", fromlist=["MarketplaceCategory"]
        ).MarketplaceCategory.objects.all(),
        source="category",
        write_only=True,
    )
    media = MarketplaceListingMediaSerializer(many=True, read_only=True)
    is_saved = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()

    class Meta:
        model = __import__(
            "main.marketplace_models", fromlist=["MarketplaceListing"]
        ).MarketplaceListing
        fields = [
            "id",
            "seller",
            "title",
            "description",
            "category",
            "category_id",
            "price",
            "condition",
            "contact_preference",
            "delivery_options",
            "location",
            "latitude",
            "longitude",
            "status",
            "views_count",
            "saved_count",
            "messages_count",
            "is_verified",
            "is_flagged",
            "media",
            "is_saved",
            "reactions",
            "created_at",
            "updated_at",
            "expires_at",
            "sold_at",
        ]
        read_only_fields = [
            "id",
            "seller",
            "views_count",
            "saved_count",
            "messages_count",
            "created_at",
            "updated_at",
        ]

    def get_is_saved(self, obj):
        try:
            request = self.context.get("request")
            if request and request.user.is_authenticated:
                return (
                    __import__("main.marketplace_models", fromlist=["MarketplaceSave"])
                    .MarketplaceSave.objects.filter(user=request.user, listing=obj)
                    .exists()
                )
            return False
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error checking if listing {obj.id} is saved: {e}")
            return False

    def get_reactions(self, obj):
        try:
            reactions = obj.reactions.all()
            return ReactionSerializer(reactions, many=True, context=self.context).data
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error getting reactions for listing {obj.id}: {e}")
            return []


class MarketplaceSaveSerializer(serializers.ModelSerializer):
    listing = MarketplaceListingSerializer(read_only=True)
    listing_id = serializers.PrimaryKeyRelatedField(
        queryset=__import__(
            "main.marketplace_models", fromlist=["MarketplaceListing"]
        ).MarketplaceListing.objects.all(),
        source="listing",
        write_only=True,
    )

    class Meta:
        model = __import__(
            "main.marketplace_models", fromlist=["MarketplaceSave"]
        ).MarketplaceSave
        fields = ["id", "listing", "listing_id", "created_at"]
        read_only_fields = ["id", "created_at"]


class MarketplaceReportSerializer(serializers.ModelSerializer):
    reporter = UserSerializer(read_only=True)

    class Meta:
        model = __import__(
            "main.marketplace_models", fromlist=["MarketplaceReport"]
        ).MarketplaceReport
        fields = [
            "id",
            "listing",
            "reporter",
            "reason",
            "description",
            "status",
            "reviewed_by",
            "review_notes",
            "created_at",
            "reviewed_at",
        ]
        read_only_fields = [
            "id",
            "reporter",
            "status",
            "reviewed_by",
            "review_notes",
            "reviewed_at",
            "created_at",
        ]


class MarketplaceOfferSerializer(serializers.ModelSerializer):
    buyer = UserSerializer(read_only=True)
    listing_id = serializers.PrimaryKeyRelatedField(
        queryset=__import__(
            "main.marketplace_models", fromlist=["MarketplaceListing"]
        ).MarketplaceListing.objects.all(),
        source="listing",
        write_only=True,
    )
    listing = serializers.SerializerMethodField()

    class Meta:
        model = __import__(
            "main.marketplace_models", fromlist=["MarketplaceOffer"]
        ).MarketplaceOffer
        fields = [
            "id",
            "listing",
            "listing_id",
            "buyer",
            "offered_price",
            "message",
            "status",
            "responded_at",
            "response_message",
            "created_at",
            "expires_at",
        ]
        read_only_fields = ["id", "buyer", "status", "responded_at", "created_at", "listing"]

    def get_listing(self, obj):
        """Return full listing details with seller info."""
        try:
            listing_serializer = MarketplaceListingSerializer(
                obj.listing, context=self.context
            )
            return listing_serializer.data
        except Exception as e:
            # Fallback to basic listing info if serialization fails
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error serializing listing in offer: {e}")
            return {
                "id": obj.listing.id,
                "title": obj.listing.title,
                "price": str(obj.listing.price),
            }


class SellerVerificationSerializer(serializers.ModelSerializer):
    seller = UserSerializer(read_only=True)

    class Meta:
        model = __import__(
            "main.marketplace_models", fromlist=["SellerVerification"]
        ).SellerVerification
        fields = [
            "id",
            "seller",
            "verification_type",
            "status",
            "verified_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "seller", "verified_at", "created_at", "updated_at"]


class PageInviteSerializer(serializers.ModelSerializer):
    page = PageSummarySerializer(read_only=True)
    sender = UserSerializer(read_only=True)
    recipient = UserSerializer(read_only=True)

    class Meta:
        model = PageInvite
        fields = [
            "id",
            "page",
            "sender",
            "recipient",
            "status",
            "created_at",
            "responded_at",
        ]
        read_only_fields = fields


class UserFeedPreferenceSerializer(serializers.ModelSerializer):
    category_choices = serializers.SerializerMethodField()

    class Meta:
        model = UserFeedPreference
        fields = [
            "id",
            "show_friend_posts",
            "show_page_posts",
            "preferred_categories",
            "show_other_categories",
            "category_choices",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "category_choices"]

    def get_category_choices(self, obj):
        """Return all available page categories"""
        return Page.CATEGORY_CHOICES
