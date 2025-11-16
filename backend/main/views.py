import asyncio
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.mail import EmailMessage
from redis import asyncio as redis_async
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiExample
from rest_framework.pagination import PageNumberPagination
from rest_framework import status
from django.db.models import Q
from django.utils import timezone
from django.conf import settings
from .models import (
    Post,
    Comment,
    Reaction,
    Bookmark,
    Notification,
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
from .realtime import conversation_group_name
from .serializers import (
    PostSerializer,
    CommentSerializer,
    ReactionSerializer,
    NotificationSerializer,
    BookmarkSerializer,
    DeviceTokenSerializer,
    ConversationSerializer,
    MessageSerializer,
    PageSerializer,
    PageAdminSerializer,
    PageAdminInviteSerializer,
    PageFollowerSerializer,
    PageInviteSerializer,
    UserFeedPreferenceSerializer,
)
from users.models import Friends
from users.emails import send_page_admin_invite_email
from .emails import send_page_invite_email


def send_page_invite_push_notification(recipient, sender, page):
    """Send push notification for page invite"""
    try:
        from .models import Notification
        from django.contrib.contenttypes.models import ContentType

        # Create notification record
        page_invite_ct = ContentType.objects.get_for_model(
            __import__("main.models", fromlist=["PageInvite"]).PageInvite
        )

        notification = Notification.objects.create(
            recipient=recipient,
            actor=sender,
            verb="page_invite",
            content_type=page_invite_ct,
            object_id=page.id,
        )
        return notification
    except Exception as e:
        logging.error(f"Failed to create page invite notification: {e}")
        raise


async def _ping_redis_async(redis_url: str) -> None:
    client = redis_async.Redis.from_url(redis_url)
    try:
        await client.ping()
    finally:
        await client.close()


def _check_redis_connection(redis_url: str):
    """Return (connected, error_message)."""
    if not redis_url:
        return False, "REDIS_URL is not configured"

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_ping_redis_async(redis_url))
        return True, None
    except Exception as exc:
        return False, str(exc)
    finally:
        loop.close()


def _page_admin_entry(page: Page, user, roles=None):
    if not user or not user.is_authenticated:
        return None
    qs = PageAdmin.objects.filter(page=page, user=user)
    if roles:
        qs = qs.filter(role__in=roles)
    return qs.first()


class PostViewSet(ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            Post.objects.filter(deleted_at__isnull=True)
            .select_related("author", "page")
            .prefetch_related(
                "comments__author",
                "comments__media",
                "comments__reactions__user",
                "comments__replies",
                "media",
                "reactions__user",
                "bookmarks__user",
            )
            .order_by("-created_at")
        )
        mine = self.request.query_params.get("mine")
        if mine is not None and str(mine).lower() in ("1", "true", "yes"):
            managed_pages = PageAdmin.objects.filter(
                user=self.request.user
            ).values_list("page_id", flat=True)
            return qs.filter(Q(author=self.request.user) | Q(page_id__in=managed_pages))
        return qs

    def perform_create(self, serializer):
        page = serializer.validated_data.get("page")
        if page:
            if not _page_admin_entry(page, self.request.user):
                raise PermissionDenied("You do not manage this page.")
            serializer.save(author=self.request.user, author_type="page")
        else:
            serializer.save(author=self.request.user, author_type="user")

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.author_type == "page":
            if not _page_admin_entry(instance.page, self.request.user):
                raise PermissionDenied("You are not allowed to edit this page post.")
        elif instance.author != self.request.user:
            raise PermissionDenied("You are not allowed to edit this post.")
        serializer.save(edited_at=timezone.now())

    def perform_destroy(self, instance):
        if instance.author_type == "page":
            if not _page_admin_entry(instance.page, self.request.user):
                raise PermissionDenied("You are not allowed to delete this page post.")
        elif instance.author != self.request.user:
            raise PermissionDenied("You are not allowed to delete this post.")
        instance.deleted_at = timezone.now()
        instance.save()


class CommentViewSet(ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.author != self.request.user:
            raise PermissionDenied("You are not allowed to edit this comment.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.author != self.request.user:
            raise PermissionDenied("You are not allowed to delete this comment.")
        instance.delete()


class ReactionViewSet(ModelViewSet):
    queryset = Reaction.objects.all()
    serializer_class = ReactionSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        # Notification is now handled by the signal in signals.py


class NotificationViewSet(ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        n = self.get_object()
        if n.recipient != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        n.unread = False
        n.save()
        return Response({"status": "ok"})

    @action(detail=False, methods=["post"], url_path="mark_all_read")
    def mark_all_read(self, request):
        updated = Notification.objects.filter(
            recipient=request.user, unread=True
        ).update(unread=False)
        return Response({"updated": updated})


class BookmarkViewSet(ModelViewSet):
    queryset = Bookmark.objects.all()
    serializer_class = BookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeviceTokenViewSet(ModelViewSet):
    queryset = DeviceToken.objects.all()
    serializer_class = DeviceTokenSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        return DeviceToken.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PageViewSet(ModelViewSet):
    serializer_class = PageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            Page.objects.filter(is_active=True)
            .select_related("created_by")
            .prefetch_related("followers", "admins__user")
        )
        query = self.request.query_params.get("q")
        if query:
            qs = qs.filter(name__icontains=query)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        page = serializer.save(created_by=self.request.user)
        PageAdmin.objects.create(
            page=page,
            user=self.request.user,
            role="owner",
            added_by=self.request.user,
        )
        # Auto-follow page for owner
        page.followers.add(self.request.user)

    def perform_update(self, serializer):
        page = serializer.instance
        if not _page_admin_entry(page, self.request.user):
            raise PermissionDenied("You are not allowed to update this page.")
        serializer.save()

    def perform_destroy(self, instance):
        if not PageAdmin.objects.filter(
            page=instance, user=self.request.user, role="owner"
        ).exists():
            raise PermissionDenied("Only the page owner can deactivate this page.")
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        page_ids = PageAdmin.objects.filter(user=request.user).values_list(
            "page_id", flat=True
        )
        pages = self.get_queryset().filter(id__in=page_ids)
        serializer = self.get_serializer(pages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="admins")
    def list_admins(self, request, pk=None):
        page = self.get_object()
        if not _page_admin_entry(page, request.user):
            raise PermissionDenied("Only page admins can view this list.")
        admins = page.admins.select_related("user", "added_by")
        serializer = PageAdminSerializer(admins, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["delete"], url_path="admins/(?P<user_id>[^/.]+)")
    def remove_admin(self, request, pk=None, user_id=None):
        page = self.get_object()
        owner_entry = PageAdmin.objects.filter(
            page=page, user=request.user, role="owner"
        ).first()
        if not owner_entry:
            raise PermissionDenied("Only the page owner can remove admins.")
        admin = page.admins.filter(user__id=user_id).first()
        if not admin:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if admin.role == "owner":
            return Response(
                {"detail": "Cannot remove the page owner."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        admin.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="invite-admin")
    def send_invite(self, request, pk=None):
        page = self.get_object()
        if not _page_admin_entry(page, request.user):
            raise PermissionDenied("Only page admins can send invites.")

        # Accept both invitee_id and email for flexibility
        invitee_id = request.data.get("invitee_id")
        email = request.data.get("email")
        role = request.data.get("role", "admin")

        if role not in dict(PageAdmin.ROLE_CHOICES):
            role = "admin"
        if role == "owner":
            return Response(
                {"detail": "Cannot assign owner role via invite."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_model = get_user_model()
        invitee = None

        # Lookup user by ID first, then by email
        if invitee_id:
            try:
                invitee = user_model.objects.get(id=invitee_id)
            except user_model.DoesNotExist:
                return Response(
                    {"detail": "Invitee not found."}, status=status.HTTP_404_NOT_FOUND
                )
        elif email:
            try:
                invitee = user_model.objects.get(email=email)
            except user_model.DoesNotExist:
                return Response(
                    {"detail": "User with this email not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            return Response(
                {"detail": "Either invitee_id or email must be provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if PageAdmin.objects.filter(page=page, user=invitee).exists():
            return Response(
                {"detail": "User is already an admin for this page."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invite = PageAdminInvite.objects.create(
            page=page,
            inviter=request.user,
            invitee=invitee,
            role=role,
        )

        # Send email notification to invitee using template
        try:
            send_page_admin_invite_email(invitee, request.user, page)
        except Exception as e:
            # Log the error but don't fail the entire request
            logging.error(f"Failed to send invite email: {e}")

        serializer = PageAdminInviteSerializer(invite)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="admin-invites")
    def list_invites(self, request, pk=None):
        page = self.get_object()
        if not _page_admin_entry(page, request.user):
            raise PermissionDenied("Only page admins can view invites.")
        invites = page.admin_invites.select_related("invitee", "inviter")
        serializer = PageAdminInviteSerializer(invites, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="follow")
    def follow(self, request, pk=None):
        page = self.get_object()
        follower, created = PageFollower.objects.get_or_create(
            page=page, user=request.user
        )
        following = True
        if not created:
            follower.delete()
            following = False
        return Response(
            {
                "following": following,
                "follower_count": page.followers.count(),
            }
        )

    @action(detail=True, methods=["post"], url_path="send-invites")
    def send_invites(self, request, pk=None):
        """Send page follow invites to friends"""
        logger = logging.getLogger(__name__)

        try:
            page = self.get_object()
        except Exception as e:
            logger.error(f"Failed to get page object: {e}")
            raise

        # Check if user is admin/mod/owner/editor of the page
        admin_entry = _page_admin_entry(page, request.user)
        if not admin_entry:
            logger.error(f"User {request.user.id} is not an admin of page {page.id}")
            raise PermissionDenied("Only page admins can send invites.")

        logger.info(
            f"User {request.user.id} is admin of page {page.id} with role: {admin_entry.role}"
        )

        # Get list of friend IDs to invite
        logger.info(f"request.data: {request.data}")
        logger.info(f"request.data type: {type(request.data)}")
        logger.info(f"request.content_type: {request.content_type}")

        friend_ids = request.data.get("friend_ids", [])

        logger.info(f"friend_ids value: {friend_ids}, type: {type(friend_ids)}")

        if not friend_ids:
            logger.error(f"friend_ids is empty or falsy")
            return Response(
                {"detail": "At least one friend_id must be provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(friend_ids, list):
            logger.error(f"friend_ids is not a list, got {type(friend_ids)}")
            return Response(
                {"detail": "friend_ids must be a list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_model = get_user_model()
        invites_created = []
        errors = []

        for friend_id in friend_ids:
            logger.info(f"Processing friend_id: {friend_id}, type: {type(friend_id)}")
            try:
                # Convert string UUID to UUID object if needed
                from uuid import UUID

                try:
                    # Try to convert to UUID if it looks like a UUID string
                    if (
                        isinstance(friend_id, str) and len(friend_id) == 36
                    ):  # UUID string format
                        friend_id_converted = UUID(friend_id)
                    else:
                        friend_id_converted = friend_id
                except (ValueError, AttributeError):
                    friend_id_converted = friend_id

                logger.info(
                    f"Converted friend_id: {friend_id_converted}, type: {type(friend_id_converted)}"
                )
                friend = user_model.objects.get(id=friend_id_converted)
                logger.info(f"Found user: {friend.id}")
            except user_model.DoesNotExist:
                logger.error(f"User not found with id: {friend_id}")
                errors.append({"friend_id": friend_id, "error": "User not found"})
                continue
            except Exception as e:
                logger.error(f"Error looking up user {friend_id}: {e}")
                errors.append(
                    {"friend_id": friend_id, "error": f"Invalid user ID: {str(e)}"}
                )
                continue

            # Check if already following
            if page.followers.filter(user=friend).exists():
                errors.append({"friend_id": friend_id, "error": "Already following"})
                continue

            # Check if invite already exists
            existing_invite = PageInvite.objects.filter(
                page=page, recipient=friend, status="pending"
            ).first()
            if existing_invite:
                errors.append({"friend_id": friend_id, "error": "Invite already sent"})
                continue

            # Create the invite
            try:
                invite = PageInvite.objects.create(
                    page=page,
                    sender=request.user,
                    recipient=friend,
                    status="pending",
                )
                invites_created.append(invite)

                # Send email and push notification
                try:
                    send_page_invite_email(friend, request.user, page)
                except Exception as e:
                    logging.error(f"Failed to send invite email to {friend.email}: {e}")

                try:
                    send_page_invite_push_notification(friend, request.user, page)
                except Exception as e:
                    logging.error(
                        f"Failed to send push notification to {friend.id}: {e}"
                    )

            except Exception as e:
                errors.append({"friend_id": friend_id, "error": str(e)})

        serializer = PageInviteSerializer(invites_created, many=True)

        # Log final response
        logger.info(
            f"Returning response: total_sent={len(invites_created)}, total_errors={len(errors)}"
        )

        response_data = {
            "invites_sent": serializer.data,
            "errors": errors,
            "total_sent": len(invites_created),
            "total_errors": len(errors),
        }

        # Return 201 if at least one invite was created, otherwise 200 OK with error details
        # Only return 400 if the request itself was invalid (empty friend_ids, not a list, etc.)
        response_status = (
            status.HTTP_201_CREATED if invites_created else status.HTTP_200_OK
        )

        logger.info(f"Response status: {response_status}")

        return Response(response_data, status=response_status)

    @action(detail=True, methods=["get"], url_path="followers")
    def followers(self, request, pk=None):
        page = self.get_object()
        followers = page.followers.select_related("user")
        serializer = PageFollowerSerializer(followers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="posts")
    def page_posts(self, request, pk=None):
        page = self.get_object()
        if request.method.lower() == "get":
            posts = page.posts.filter(deleted_at__isnull=True).select_related(
                "author", "page"
            )
            paginator = PageNumberPagination()
            paginated = paginator.paginate_queryset(posts, request)
            target = paginated if paginated is not None else posts
            serializer = PostSerializer(
                target, many=True, context=self.get_serializer_context()
            )
            if paginated is not None:
                return paginator.get_paginated_response(serializer.data)
            return Response(serializer.data)

        if not _page_admin_entry(page, request.user):
            raise PermissionDenied("Only page admins can post as the page.")
        serializer = PostSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(author=request.user, page=page, author_type="page")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="update-profile-image")
    def update_profile_image(self, request, pk=None):
        page = self.get_object()
        if not _page_admin_entry(page, request.user):
            raise PermissionDenied("Only page admins can update the profile image.")

        profile_image_url = request.data.get("profile_image_url")
        if not profile_image_url:
            return Response(
                {"detail": "profile_image_url is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        page.profile_image_url = profile_image_url
        page.save(update_fields=["profile_image_url"])

        serializer = self.get_serializer(page)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PageAdminInviteViewSet(ModelViewSet):
    serializer_class = PageAdminInviteSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "delete", "post"]

    def get_queryset(self):
        return PageAdminInvite.objects.filter(invitee=self.request.user).select_related(
            "page", "inviter", "invitee"
        )

    def destroy(self, request, *args, **kwargs):
        invite = self.get_object()
        if (
            invite.inviter != request.user
            and not PageAdmin.objects.filter(
                page=invite.page, user=request.user, role="owner"
            ).exists()
        ):
            raise PermissionDenied("You cannot cancel this invite.")
        invite.status = "cancelled"
        invite.responded_at = timezone.now()
        invite.save(update_fields=["status", "responded_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        invite = self.get_object()
        if invite.invitee != request.user:
            raise PermissionDenied("This invite was not addressed to you.")
        if invite.status != "pending":
            return Response(
                {"detail": "Invite already processed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        PageAdmin.objects.update_or_create(
            page=invite.page,
            user=request.user,
            defaults={"role": invite.role, "added_by": invite.inviter},
        )
        invite.status = "accepted"
        invite.responded_at = timezone.now()
        invite.save(update_fields=["status", "responded_at"])
        serializer = self.get_serializer(invite)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        invite = self.get_object()
        if invite.invitee != request.user:
            raise PermissionDenied("This invite was not addressed to you.")
        if invite.status != "pending":
            return Response(
                {"detail": "Invite already processed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invite.status = "declined"
        invite.responded_at = timezone.now()
        invite.save(update_fields=["status", "responded_at"])
        serializer = self.get_serializer(invite)
        return Response(serializer.data)


class PageInviteViewSet(ModelViewSet):
    """ViewSet for managing page follow invites"""

    serializer_class = PageInviteSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post"]

    def get_queryset(self):
        """Get invites for the current user"""
        return PageInvite.objects.filter(recipient=self.request.user).select_related(
            "page", "sender", "recipient"
        )

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        """Accept a page invite and follow the page"""
        invite = self.get_object()
        if invite.recipient != request.user:
            raise PermissionDenied("This invite was not addressed to you.")
        if invite.status != "pending":
            return Response(
                {"detail": "Invite already processed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create follower relationship
        PageFollower.objects.get_or_create(page=invite.page, user=request.user)

        # Update invite status
        invite.status = "accepted"
        invite.responded_at = timezone.now()
        invite.save(update_fields=["status", "responded_at"])

        serializer = self.get_serializer(invite)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        """Decline a page invite"""
        invite = self.get_object()
        if invite.recipient != request.user:
            raise PermissionDenied("This invite was not addressed to you.")
        if invite.status != "pending":
            return Response(
                {"detail": "Invite already processed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invite.status = "declined"
        invite.responded_at = timezone.now()
        invite.save(update_fields=["status", "responded_at"])

        serializer = self.get_serializer(invite)
        return Response(serializer.data)


class ConversationViewSet(ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        user = self.request.user
        return (
            Conversation.objects.filter(participants__user=user)
            .select_related("created_by")
            .prefetch_related("participants__user")
            .distinct()
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.created_by != self.request.user:
            raise PermissionDenied("Only the creator can delete a conversation.")
        instance.delete()

    def _ensure_participant(self, conversation):
        if not conversation.participants.filter(user=self.request.user).exists():
            raise PermissionDenied("You are not a participant of this conversation.")
        return conversation

    @action(detail=True, methods=["get"], url_path="messages")
    def list_messages(self, request, pk=None):
        conversation = self._ensure_participant(self.get_object())
        paginator = PageNumberPagination()
        paginator.page_size = int(request.query_params.get("page_size", 25))
        qs = (
            conversation.messages.select_related("sender")
            .prefetch_related("reactions__user")
            .order_by("-created_at")
        )
        page = paginator.paginate_queryset(qs, request)
        serializer = MessageSerializer(
            page, many=True, context=self.get_serializer_context()
        )
        return paginator.get_paginated_response(serializer.data)

    @list_messages.mapping.post
    def send_message(self, request, pk=None):
        conversation = self._ensure_participant(self.get_object())
        content = (request.data.get("content") or "").strip()
        media_url = request.data.get("media_url")
        reply_to_id = request.data.get("reply_to")

        if not content and not media_url:
            return Response(
                {"detail": "Message content or media_url is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reply_to = None
        if reply_to_id:
            try:
                reply_to = conversation.messages.get(id=reply_to_id)
            except Message.DoesNotExist:
                return Response(
                    {"detail": "Reply target not found in this conversation."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=content,
            media_url=media_url,
            reply_to=reply_to,
        )
        ConversationParticipant.objects.filter(
            conversation=conversation, user=request.user
        ).update(last_read_at=timezone.now())
        Conversation.objects.filter(id=conversation.id).update(
            last_message_at=message.created_at
        )

        recipients = conversation.participants.exclude(
            user=request.user
        ).select_related("user")
        if recipients:
            conversation_ct = ContentType.objects.get_for_model(Conversation)
            Notification.objects.bulk_create(
                [
                    Notification(
                        recipient=participant.user,
                        actor=request.user,
                        verb="messaged",
                        content_type=conversation_ct,
                        object_id=conversation.id,
                    )
                    for participant in recipients
                ]
            )

        serializer = MessageSerializer(message, context=self.get_serializer_context())

        layer = get_channel_layer()
        if layer:
            try:
                async_to_sync(layer.group_send)(
                    conversation_group_name(str(conversation.id)),
                    {"type": "chat_message", "data": serializer.data},
                )
            except Exception:
                pass

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        conversation = self._ensure_participant(self.get_object())
        updated_count = ConversationParticipant.objects.filter(
            conversation=conversation, user=request.user
        ).update(last_read_at=timezone.now())
        return Response({"updated": updated_count})

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path="messages/(?P<message_id>[^/.]+)",
    )
    def message_action(self, request, pk=None, message_id=None):
        """Edit or delete a message."""
        conversation = self._ensure_participant(self.get_object())
        try:
            message = conversation.messages.get(id=message_id)
        except Message.DoesNotExist:
            return Response(
                {"detail": "Message not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if message.sender != request.user:
            return Response(
                {"detail": "You can only edit or delete your own messages."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.method == "PATCH":
            # Edit message
            content = request.data.get("content", "").strip()
            if not content:
                return Response(
                    {"detail": "Message content cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            message.content = content
            message.edited_at = timezone.now()
            message.save(update_fields=["content", "edited_at", "updated_at"])

            serializer = MessageSerializer(
                message, context=self.get_serializer_context()
            )

            # Broadcast update via WebSocket
            layer = get_channel_layer()
            if layer:
                try:
                    async_to_sync(layer.group_send)(
                        conversation_group_name(str(conversation.id)),
                        {"type": "message_updated", "data": serializer.data},
                    )
                except Exception:
                    pass

            return Response(serializer.data)

        elif request.method == "DELETE":
            # Delete message (soft delete)
            message.is_deleted = True
            message.save(update_fields=["is_deleted", "updated_at"])
            # Refresh to get reactions
            message.refresh_from_db()
            message.reactions.prefetch_related("user")

            serializer = MessageSerializer(
                message, context=self.get_serializer_context()
            )

            # Broadcast deletion via WebSocket
            layer = get_channel_layer()
            if layer:
                try:
                    async_to_sync(layer.group_send)(
                        conversation_group_name(str(conversation.id)),
                        {"type": "message_deleted", "data": serializer.data},
                    )
                except Exception:
                    pass

            return Response(serializer.data, status=status.HTTP_200_OK)


class FirebaseConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, _request):
        config = {
            "apiKey": settings.FIREBASE_WEB_API_KEY,
            "authDomain": settings.FIREBASE_WEB_AUTH_DOMAIN,
            "projectId": settings.FIREBASE_WEB_PROJECT_ID,
            "storageBucket": settings.FIREBASE_WEB_STORAGE_BUCKET,
            "messagingSenderId": settings.FIREBASE_WEB_MESSAGING_SENDER_ID,
            "appId": settings.FIREBASE_WEB_APP_ID,
            "measurementId": settings.FIREBASE_WEB_MEASUREMENT_ID,
        }
        filtered = {key: value for key, value in config.items() if value}
        if not filtered:
            return Response(
                {"detail": "Firebase config unavailable."},
                status=status.HTTP_404_NOT_FOUND,
            )
        payload = {"config": filtered}
        if settings.FIREBASE_WEB_VAPID_KEY:
            payload["vapidKey"] = settings.FIREBASE_WEB_VAPID_KEY
        return Response(payload)


class RedisHealthView(APIView):
    """Diagnostic endpoint to test Redis connectivity for Channels."""

    permission_classes = [AllowAny]

    def get(self, request):
        logger = logging.getLogger(__name__)

        diagnostics = {
            "channel_layer_available": False,
            "redis_configured": False,
            "redis_connected": False,
            "error": None,
        }

        try:
            layer = get_channel_layer()
            if not layer:
                diagnostics["error"] = "No channel layer configured"
                status_code = status.HTTP_503_SERVICE_UNAVAILABLE
                return Response(diagnostics, status=status_code)

            diagnostics["channel_layer_available"] = True
            diagnostics["redis_configured"] = True

            redis_url = getattr(settings, "REDIS_URL", "")
            connected, error = _check_redis_connection(redis_url)
            diagnostics["redis_connected"] = connected
            if error:
                diagnostics["redis_error"] = error
        except Exception as e:
            diagnostics["error"] = str(e)
            logger.exception("Error checking Redis health")

        status_code = (
            status.HTTP_200_OK
            if diagnostics["redis_connected"]
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return Response(diagnostics, status=status_code)


class WebSocketDiagnosticView(APIView):
    """Diagnostic endpoint to test WebSocket infrastructure."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        logger = logging.getLogger(__name__)

        diagnostics = {
            "user_authenticated": True,
            "user_id": request.user.id,
            "channel_layer_available": False,
            "redis_configured": False,
            "redis_connected": False,
            "allowed_hosts": getattr(settings, "ALLOWED_HOSTS", []),
            "redis_url_configured": bool(getattr(settings, "REDIS_URL", None)),
            "error": None,
        }

        try:
            layer = get_channel_layer()
            if not layer:
                diagnostics["error"] = "No channel layer configured"
                status_code = status.HTTP_503_SERVICE_UNAVAILABLE
                return Response(diagnostics, status=status_code)

            diagnostics["channel_layer_available"] = True
            diagnostics["redis_configured"] = True

            redis_url = getattr(settings, "REDIS_URL", "")
            connected, error = _check_redis_connection(redis_url)
            diagnostics["redis_connected"] = connected
            if error:
                diagnostics["redis_error"] = error
        except Exception as e:
            diagnostics["error"] = str(e)
            logger.exception("Error running WebSocket diagnostics")

        status_code = (
            status.HTTP_200_OK
            if diagnostics["redis_connected"]
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return Response(diagnostics, status=status_code)


class TestPushNotificationView(APIView):
    """Test endpoint to manually trigger a push notification for debugging."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        import logging
        from django.conf import settings
        from .tasks import deliver_push_notification

        logger = logging.getLogger(__name__)

        user = request.user
        diagnostics = {
            "user_id": str(user.id),
            "user_email": user.email,
            "push_notifications_enabled": getattr(
                settings, "PUSH_NOTIFICATIONS_ENABLED", False
            ),
            "firebase_project_id": getattr(settings, "FIREBASE_PROJECT_ID", ""),
            "firebase_credentials_configured": bool(
                getattr(settings, "FIREBASE_CREDENTIALS_JSON", "")
            ),
            "frontend_url": getattr(settings, "FRONTEND_URL", ""),
            "device_tokens": [],
            "notification_created": False,
            "notification_id": None,
            "task_queued": False,
            "task_id": None,
            "error": None,
        }

        try:
            # Get user's device tokens
            device_tokens = DeviceToken.objects.filter(user=user).values(
                "id", "token", "platform", "created_at", "last_seen_at"
            )
            diagnostics["device_tokens"] = list(device_tokens)
            diagnostics["device_token_count"] = len(diagnostics["device_tokens"])

            if not diagnostics["push_notifications_enabled"]:
                diagnostics["error"] = "Push notifications are not enabled"
                return Response(diagnostics, status=status.HTTP_400_BAD_REQUEST)

            if not diagnostics["firebase_credentials_configured"]:
                diagnostics["error"] = "Firebase credentials are not configured"
                return Response(diagnostics, status=status.HTTP_400_BAD_REQUEST)

            if not diagnostics["device_tokens"]:
                diagnostics["error"] = "No device tokens found for this user"
                return Response(diagnostics, status=status.HTTP_400_BAD_REQUEST)

            # Create a test notification
            test_notification = Notification.objects.create(
                recipient=user,
                actor=user,  # User notifies themselves for testing
                verb="test",
                unread=True,
            )
            diagnostics["notification_created"] = True
            diagnostics["notification_id"] = test_notification.id

            # Queue the push notification task
            try:
                task_result = deliver_push_notification.delay(test_notification.id)
                diagnostics["task_queued"] = True
                diagnostics["task_id"] = str(task_result.id)
            except Exception as e:
                diagnostics["error"] = f"Failed to queue task: {str(e)}"
                logger.exception("Failed to queue push notification task")
                return Response(
                    diagnostics, status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            diagnostics["message"] = (
                f"Test notification created (ID: {test_notification.id}) and push task queued. "
                f"Check Celery worker logs for delivery status."
            )

            return Response(diagnostics, status=status.HTTP_201_CREATED)

        except Exception as e:
            diagnostics["error"] = str(e)
            logger.exception("Error in test push notification endpoint")
            return Response(diagnostics, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class NewsFeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # get friend ids
        friend_ids = Friends.objects.filter(user=user).values_list(
            "friend_id", flat=True
        )

        # build queryset: public posts OR user's own posts OR friends' posts with friends visibility
        qs = (
            Post.objects.filter(
                Q(visibility="public")
                | Q(author=user)
                | Q(author__id__in=friend_ids, visibility="friends")
            )
            .select_related("author")
            .prefetch_related(
                "comments__author",
                "comments__media",
                "media",
                "reactions__user",
                "bookmarks__user",
            )
        )

        # exclude posts where either side has blocked the other
        blocked_ids = set(list(Friends.objects.none()))
        from users.models import BlockedUsers

        user_blocked = BlockedUsers.objects.filter(user=user).values_list(
            "blocked_user_id", flat=True
        )
        blocked_me = BlockedUsers.objects.filter(blocked_user=user).values_list(
            "user_id", flat=True
        )
        excluded_authors = set(list(user_blocked)) | set(list(blocked_me))
        if excluded_authors:
            qs = qs.exclude(author__id__in=excluded_authors)

        # Apply feed preferences filtering
        try:
            prefs = UserFeedPreference.objects.get(user=user)

            # Filter by content type (friend posts vs page posts)
            # This creates mutually exclusive conditions based on user preference
            if prefs.show_friend_posts and prefs.show_page_posts:
                # Show both - no filtering needed for content type
                pass
            elif prefs.show_friend_posts and not prefs.show_page_posts:
                # Show only friend posts (not page posts)
                qs = qs.filter(page__isnull=True)
            elif not prefs.show_friend_posts and prefs.show_page_posts:
                # Show only page posts
                qs = qs.filter(page__isnull=False)
            else:
                # Both false - show nothing (this shouldn't normally happen)
                qs = qs.none()

            # Filter by page categories (only applies to page posts)
            if prefs.preferred_categories:
                category_filter = Q(page__category__in=prefs.preferred_categories)
                if prefs.show_other_categories:
                    # Include posts without pages (friend posts are always included)
                    category_filter |= Q(page__isnull=True)
                qs = qs.filter(category_filter)
        except UserFeedPreference.DoesNotExist:
            # No preferences set, show all posts
            pass

        # pagination
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(
            qs.distinct().order_by("-created_at"), request
        )
        serializer = PostSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class UserFeedPreferenceViewSet(ModelViewSet):
    serializer_class = UserFeedPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users can only view/edit their own preferences
        return UserFeedPreference.objects.filter(user=self.request.user)

    @action(detail=False, methods=["get", "put", "patch"])
    def me(self, request):
        """Get or create user's feed preferences"""
        preferences, created = UserFeedPreference.objects.get_or_create(
            user=request.user
        )

        if request.method == "GET":
            serializer = self.get_serializer(preferences)
            return Response(serializer.data)

        # PUT/PATCH
        serializer = self.get_serializer(
            preferences, data=request.data, partial=(request.method == "PATCH")
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
