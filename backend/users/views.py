from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from .models import BlockedUsers, FriendRequest, Friends, User, UserSettings
from .serializers import (
    BlockedUsersSerializer,
    ChangePasswordSerializer,
    FriendRequestSerializer,
    FriendsSerializer,
    LoginSerializer,
    RegisterUserSerializer,
    UserSerializer,
    UserSettingsSerializer,
)
from .emails import send_welcome_email, send_password_changed_email
from rest_framework.parsers import MultiPartParser, FormParser
from main.s3 import upload_fileobj_to_s3
from main.models import Post, PostMedia
from main.serializers import PostSerializer


class LoginUserview(ModelViewSet):
    serializer_class = LoginSerializer
    http_method_names = ["post"]

    def create(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = User.objects.filter(
            Q(email=username) | Q(phone_number=username) | Q(username=username)
        ).first()
        if user and user.check_password(password):
            refresh_token = RefreshToken.for_user(user)
            return Response(
                {
                    "refresh_token": str(refresh_token),
                    "access_token": str(refresh_token.access_token),
                    "user_id": str(user.id),
                },
                status=status.HTTP_200_OK,
            )
        return Response(
            {"detail": "Invalid Credentials"}, status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def LogoutView(request):
    try:
        refresh_token = request.data.get("refresh_token")
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response(
            {"detail": "logout successful"}, status=status.HTTP_205_RESET_CONTENT
        )
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RegisterUserViewSet(ModelViewSet):
    serializer_class = RegisterUserSerializer
    permission_classes = [AllowAny]
    http_method_names = ["post"]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save(*args, **kwargs)
        refresh_token = RefreshToken.for_user(user)

        # Send welcome email in the background
        try:
            send_welcome_email(user)
        except Exception:
            # Log but don't fail registration if email fails
            pass

        return Response(
            {
                "user_id": user.id,
                "refresh_token": str(refresh_token),
                "access_token": str(refresh_token.access_token),
            },
            status=status.HTTP_201_CREATED,
        )


class UserView(ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer
    queryset = User.objects.all()
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        # For list, return only the requesting user's profile
        if self.action == "list":
            return super().get_queryset().filter(id=self.request.user.id)
        return super().get_queryset()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # owner can always view
        if instance == request.user:
            serializer = self.get_serializer(instance)
            return Response(serializer.data)

        # deny if blocked either way
        if (
            BlockedUsers.objects.filter(
                user=instance, blocked_user=request.user
            ).exists()
            or BlockedUsers.objects.filter(
                user=request.user, blocked_user=instance
            ).exists()
        ):
            return Response(
                {"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN
            )

        # check privacy settings
        settings = getattr(instance, "user_settings", None)
        privacy = (
            getattr(settings, "profile_privacy", "public")
            if settings is not None
            else "public"
        )
        if privacy == "only_me":
            return Response(
                {"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN
            )
        if privacy == "private":
            # only friends may view
            if not Friends.objects.filter(user=instance, friend=request.user).exists():
                return Response(
                    {"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN
                )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class UserOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        viewer = request.user
        try:
            target = User.objects.select_related("user_settings").get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )

        is_self = viewer == target

        blocked_by_target = False
        if not is_self:
            blocked_by_target = BlockedUsers.objects.filter(
                user=target, blocked_user=viewer
            ).exists()
            if blocked_by_target:
                return Response(
                    {"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN
                )

        viewer_block_record = BlockedUsers.objects.filter(
            user=viewer, blocked_user=target
        ).first()
        viewer_has_blocked = viewer_block_record is not None

        is_friend = False
        friend_record = None
        if not is_self:
            friend_record = Friends.objects.filter(user=viewer, friend=target).first()
            is_friend = friend_record is not None

        incoming_request = None
        outgoing_request = None
        if not is_self:
            incoming_request = FriendRequest.objects.filter(
                from_user=target, to_user=viewer, status="pending"
            ).first()
            outgoing_request = FriendRequest.objects.filter(
                from_user=viewer, to_user=target, status="pending"
            ).first()

        settings = getattr(target, "user_settings", None)
        profile_privacy = (
            getattr(settings, "profile_privacy", "public") if settings else "public"
        )
        friends_publicity = (
            getattr(settings, "friends_publicity", "public") if settings else "public"
        )

        can_view_posts = True
        if not is_self:
            if profile_privacy == "only_me":
                can_view_posts = False
            elif profile_privacy == "private" and not is_friend:
                can_view_posts = False
        if viewer_has_blocked and not is_self:
            # viewer chose to block; still allow viewing profile metadata but hide posts
            can_view_posts = False

        allowed_posts_qs = Post.objects.filter(author=target, deleted_at__isnull=True)
        if not is_self:
            visibility_levels = ["public"]
            if is_friend:
                visibility_levels.append("friends")
            allowed_posts_qs = allowed_posts_qs.filter(visibility__in=visibility_levels)
        if not can_view_posts:
            allowed_posts_qs = Post.objects.none()

        post_count = allowed_posts_qs.count() if can_view_posts else None
        recent_posts_data = []
        photos = []
        if can_view_posts:
            recent_posts_list = list(allowed_posts_qs.order_by("-created_at")[:6])
            if recent_posts_list:
                recent_posts_data = PostSerializer(
                    recent_posts_list, many=True, context={"request": request}
                ).data
            post_ids_for_photos = list(
                allowed_posts_qs.order_by("-created_at").values_list("id", flat=True)[
                    :30
                ]
            )
            if post_ids_for_photos:
                photos = list(
                    PostMedia.objects.filter(post_id__in=post_ids_for_photos)
                    .order_by("-id")
                    .values_list("url", flat=True)[:12]
                )

        can_view_friend_count = True
        if not is_self:
            if friends_publicity == "only_me":
                can_view_friend_count = False
            elif friends_publicity == "private" and not is_friend:
                can_view_friend_count = False
        friend_count = (
            Friends.objects.filter(user=target).count()
            if can_view_friend_count
            else None
        )

        incoming_request_id = incoming_request.id if incoming_request else None
        outgoing_request_id = outgoing_request.id if outgoing_request else None
        friend_entry_id = friend_record.id if friend_record else None
        viewer_block_id = viewer_block_record.id if viewer_block_record else None

        if is_self:
            relationship_status = "self"
        elif viewer_has_blocked:
            relationship_status = "viewer_blocked"
        elif blocked_by_target:
            relationship_status = "blocked_by_target"
        elif is_friend:
            relationship_status = "friend"
        elif incoming_request_id:
            relationship_status = "incoming_request"
        elif outgoing_request_id:
            relationship_status = "outgoing_request"
        else:
            relationship_status = "none"

        relationship = {
            "is_self": is_self,
            "is_friend": is_friend,
            "status": relationship_status,
            "incoming_request": bool(incoming_request_id),
            "incoming_request_id": incoming_request_id,
            "outgoing_request": bool(outgoing_request_id),
            "outgoing_request_id": outgoing_request_id,
            "friend_entry_id": friend_entry_id,
            "viewer_has_blocked": viewer_has_blocked,
            "viewer_block_id": viewer_block_id,
            "blocked_by_target": blocked_by_target,
            "can_send_friend_request": (
                not is_self
                and not is_friend
                and not incoming_request_id
                and not outgoing_request_id
                and not viewer_has_blocked
                and not blocked_by_target
            ),
        }

        user_data = {
            "id": str(target.id),
            "username": target.username,
            "first_name": target.first_name,
            "last_name": target.last_name,
            "profile_image_url": target.profile_image_url,
            "bio": target.bio,
            "date_joined": (
                target.date_joined.isoformat() if target.date_joined else None
            ),
        }

        stats = {
            "post_count": post_count if can_view_posts else None,
            "friend_count": friend_count if can_view_friend_count else None,
            "photos": photos if can_view_posts else [],
        }

        return Response(
            {
                "user": user_data,
                "stats": stats,
                "relationship": relationship,
                "recent_posts": recent_posts_data if can_view_posts else [],
                "can_view_posts": can_view_posts,
                "can_view_friend_count": can_view_friend_count,
                "privacy": {
                    "profile_privacy": profile_privacy,
                    "friends_publicity": friends_publicity,
                },
            }
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance != request.user:
            return Response(
                {"detail": "Not authorized to update this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance != request.user:
            return Response(
                {"detail": "Not authorized to update this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DefaultPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class FriendsViewset(ModelViewSet):
    queryset = Friends.objects.all()
    serializer_class = FriendsSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete"]
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(user=self.request.user)
            .order_by("-created_at")
        )

    def destroy(self, request, *args, **kwargs):
        # Unfriend: delete reciprocal friendship rows
        instance = self.get_object()
        # Only allow the owner to remove their friend
        if instance.user != request.user:
            return Response(
                {"detail": "Not authorized to remove this friend."},
                status=status.HTTP_403_FORBIDDEN,
            )
        friend = instance.friend
        from django.db import transaction

        with transaction.atomic():
            Friends.objects.filter(user=request.user, friend=friend).delete()
            Friends.objects.filter(user=friend, friend=request.user).delete()
        return Response({"detail": "Friend removed."}, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAuthenticated],
        url_path="suggestions",
    )
    def suggestions(self, request):
        user = request.user

        friend_ids = Friends.objects.filter(user=user).values_list(
            "friend_id", flat=True
        )
        reverse_friend_ids = Friends.objects.filter(friend=user).values_list(
            "user_id", flat=True
        )
        sent_requests = FriendRequest.objects.filter(from_user=user).values_list(
            "to_user_id", flat=True
        )
        incoming_requests = FriendRequest.objects.filter(to_user=user).values_list(
            "from_user_id", flat=True
        )
        blocked_ids = BlockedUsers.objects.filter(user=user).values_list(
            "blocked_user_id", flat=True
        )
        blocked_me_ids = BlockedUsers.objects.filter(blocked_user=user).values_list(
            "user_id", flat=True
        )

        exclude_ids = (
            set(friend_ids)
            | set(reverse_friend_ids)
            | set(sent_requests)
            | set(incoming_requests)
            | set(blocked_ids)
            | set(blocked_me_ids)
            | {user.id}
        )

        qs = User.objects.exclude(id__in=exclude_ids).order_by("-date_joined")

        paginator = DefaultPageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = UserSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class FriendRequestViewset(ModelViewSet):
    queryset = FriendRequest.objects.all()
    serializer_class = FriendRequestSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete"]
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        # return friend requests where the current user is either sender or recipient
        qs = (
            super()
            .get_queryset()
            .filter(Q(to_user=self.request.user) | Q(from_user=self.request.user))
            .order_by("-created_at")
        )
        direction = self.request.query_params.get("direction")
        if direction == "incoming":
            qs = qs.filter(to_user=self.request.user)
        elif direction == "outgoing":
            qs = qs.filter(from_user=self.request.user)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        else:
            qs = qs.filter(status="pending")
        return qs

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated],
        url_path="decline",
    )
    def decline(self, request, *args, **kwargs):
        fr = self.get_object()
        if fr.to_user != request.user:
            return Response(
                {"detail": "Not authorized to decline this friend request."},
                status=status.HTTP_403_FORBIDDEN,
            )
        fr.status = "declined"
        fr.save()
        return Response(
            {"detail": "Friend request declined."}, status=status.HTTP_200_OK
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated],
        url_path="cancel",
    )
    def cancel(self, request, *args, **kwargs):
        fr = self.get_object()
        if fr.from_user != request.user:
            return Response(
                {"detail": "Not authorized to cancel this friend request."},
                status=status.HTTP_403_FORBIDDEN,
            )
        fr.delete()
        return Response(
            {"detail": "Friend request canceled."}, status=status.HTTP_200_OK
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated],
        url_path="accept-friend-request",
    )
    def accept(self, request, *args, **kwargs):
        friend_request = self.get_object()
        if friend_request.to_user != request.user:
            return Response(
                {"detail": "Not authorized to accept this friend request."},
                status=status.HTTP_403_FORBIDDEN,
            )
        # create symmetric friendship rows atomically
        from django.db import transaction

        with transaction.atomic():
            Friends.objects.get_or_create(
                user=friend_request.from_user, friend=friend_request.to_user
            )
            Friends.objects.get_or_create(
                user=friend_request.to_user, friend=friend_request.from_user
            )
            friend_request.status = "accepted"
            friend_request.save()

        return Response(
            {"detail": "Friend request accepted."}, status=status.HTTP_200_OK
        )


class BlockedUsersViewset(ModelViewSet):
    queryset = BlockedUsers.objects.all()
    serializer_class = BlockedUsersSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_destroy(self, instance):
        # only allow owner to unblock
        if instance.user != self.request.user:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Not authorized to unblock this user.")
        instance.delete()


class UserSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings, _ = UserSettings.objects.get_or_create(user=request.user)
        serializer = UserSettingsSerializer(settings)
        return Response(serializer.data)

    def patch(self, request):
        settings, _ = UserSettings.objects.get_or_create(user=request.user)
        serializer = UserSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save()

        # Send password changed confirmation email
        try:
            send_password_changed_email(user)
        except Exception:
            # Log but don't fail the password change if email fails
            pass

        return Response({"detail": "Password successfully changed."})


class ProfilePictureUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get("file")
        if not f:
            return Response(
                {"detail": "No file provided"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            url = upload_fileobj_to_s3(f, filename=f.name, content_type=f.content_type)
        except Exception as e:
            return Response(
                {"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        user = request.user
        user.profile_image_url = url
        user.save()
        return Response({"profile_image_url": url})
