from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.pagination import PageNumberPagination
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.db.models import Count
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from datetime import timedelta
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from .models import (
    BlockedUsers,
    DismissedSuggestion,
    FriendRequest,
    Friends,
    User,
    UserSettings,
    FriendshipHistory,
    AccountDeletionRequest,
    SocialAccount,
)
from .serializers import (
    BlockedUsersSerializer,
    ChangePasswordSerializer,
    FriendRequestSerializer,
    FriendsSerializer,
    LoginSerializer,
    RegisterUserSerializer,
    UserSerializer,
    UserSettingsSerializer,
    FriendshipHistorySerializer,
    UserStatusSerializer,
)
from .emails import send_welcome_email, send_password_changed_email
from rest_framework.parsers import MultiPartParser, FormParser
from main.s3 import upload_fileobj_to_s3
from main.models import Post, PostMedia
from main.serializers import PostSerializer
from main.slug_utils import SlugOrIdLookupMixin
from main.moderation.pipeline import precheck_text_or_raise, record_text_classification


def _create_login_session_and_tokens(
    *,
    user: User,
    request,
    authentication_method: str,
    login_description: str,
    metadata: dict | None = None,
    device_id=None,
    device_name: str | None = None,
):
    from .device_utils import (
        build_device_name,
        get_client_ip,
        get_user_agent,
        get_location_from_ip,
    )
    from .models import Session, SessionHistory, SecurityEvent

    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    location = get_location_from_ip(ip_address)
    resolved_device_name = device_name or build_device_name(
        user_agent, fallback=user_agent or "Unknown Device"
    )

    refresh_token = RefreshToken.for_user(user)
    access_token = refresh_token.access_token

    token_jti = None
    refresh_token_jti = None
    try:
        untyped_token = UntypedToken(str(access_token))
        token_jti = untyped_token.get("jti")
    except (InvalidToken, TokenError, KeyError):
        pass

    try:
        untyped_refresh_token = UntypedToken(str(refresh_token))
        refresh_token_jti = untyped_refresh_token.get("jti")
    except (InvalidToken, TokenError, KeyError):
        pass

    lookup = {
        "user": user,
        "revoked_at__isnull": True,
    }
    if device_id:
        lookup["device_id"] = device_id
    elif user_agent:
        lookup["user_agent"] = user_agent
    else:
        lookup["device_name"] = resolved_device_name

    session = Session.objects.filter(**lookup).order_by("-last_activity").first()
    if session:
        session.device_id = device_id
        session.device_name = resolved_device_name
        session.ip_address = ip_address
        session.location = location
        session.user_agent = user_agent
        session.token_jti = token_jti
        session.refresh_token_jti = refresh_token_jti
        session.revoked_at = None
        session.save(
            update_fields=[
                "device_id",
                "device_name",
                "ip_address",
                "location",
                "user_agent",
                "token_jti",
                "refresh_token_jti",
                "revoked_at",
                "last_activity",
            ]
        )
        Session.objects.filter(**lookup).exclude(id=session.id).update(revoked_at=timezone.now())
    else:
        session = Session.objects.create(
            user=user,
            device_id=device_id,
            device_name=resolved_device_name,
            ip_address=ip_address,
            location=location,
            user_agent=user_agent,
            token_jti=token_jti,
            refresh_token_jti=refresh_token_jti,
        )

    SessionHistory.objects.create(
        user=user,
        device_id=device_id,
        device_name=resolved_device_name,
        ip_address=ip_address,
        location=location,
        user_agent=user_agent,
        authentication_method=authentication_method,
    )

    event_metadata = {"session_id": str(session.id)}
    if metadata:
        event_metadata.update(metadata)
    SecurityEvent.objects.create(
        user=user,
        event_type="login",
        description=login_description,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=event_metadata,
    )

    return {
        "refresh_token": str(refresh_token),
        "access_token": str(access_token),
        "user_id": str(user.id),
    }


def _google_client_id() -> str:
    return getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "").strip()


def _verify_google_token(token: str) -> dict:
    client_id = _google_client_id()
    if not client_id:
        raise ValueError("Google OAuth is not configured on the server.")
    try:
        info = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=client_id,
        )
    except Exception as exc:
        raise ValueError("Invalid Google token.") from exc
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Invalid Google token issuer.")
    if not info.get("sub"):
        raise ValueError("Google token is missing subject.")
    if not info.get("email"):
        raise ValueError("Google token is missing email.")
    if info.get("email_verified") is not True:
        raise ValueError("Google email is not verified.")
    return info


def _build_unique_username(base: str) -> str:
    candidate = (base or "user").strip().lower()
    candidate = "".join(ch for ch in candidate if ch.isalnum() or ch in ("_", "."))
    candidate = candidate[:120] or "user"
    if not User.objects.filter(username=candidate).exists():
        return candidate
    suffix = 2
    while True:
        next_candidate = f"{candidate[:110]}{suffix}"
        if not User.objects.filter(username=next_candidate).exists():
            return next_candidate
        suffix += 1


def _normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


class LoginUserview(ModelViewSet):
    serializer_class = LoginSerializer
    http_method_names = ["post"]

    def create(self, request):
        email = _normalize_email(
            request.data.get("username")
        )  # Frontend still sends as 'username' field
        password = request.data.get("password")
        user = User.objects.filter(email__iexact=email).first()
        
        # Get device info for logging
        from .device_utils import get_client_ip, get_user_agent, get_location_from_ip
        ip_address = get_client_ip(request)
        user_agent = get_user_agent(request)
        location = get_location_from_ip(ip_address)
        
        if user and user.check_password(password):
            # Check if account is locked
            if user.account_locked_at:
                from .models import SecurityEvent
                SecurityEvent.objects.create(
                    user=user,
                    event_type="login_failed",
                    description="Login attempt on locked account",
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                return Response(
                    {"detail": "Account is locked. Please contact support."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            tokens = _create_login_session_and_tokens(
                user=user,
                request=request,
                authentication_method="password",
                login_description="Login via password",
            )
            return Response(tokens, status=status.HTTP_200_OK)
        
        # Log failed login attempt
        if user:
            from .models import SecurityEvent
            SecurityEvent.objects.create(
                user=user,
                event_type="login_failed",
                description="Invalid password",
                ip_address=ip_address,
                user_agent=user_agent,
            )
        
        return Response(
            {"detail": "Invalid Credentials"}, status=status.HTTP_401_UNAUTHORIZED
        )


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        google_token = request.data.get("id_token")
        if not google_token:
            return Response(
                {"detail": "id_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            claims = _verify_google_token(google_token)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        google_sub = claims["sub"]
        email = claims["email"].strip().lower()
        display_name = claims.get("name") or email.split("@")[0]
        avatar_url = claims.get("picture")

        with transaction.atomic():
            social = SocialAccount.objects.select_for_update().filter(
                provider=SocialAccount.PROVIDER_GOOGLE,
                provider_user_id=google_sub,
            ).first()
            linked = False

            if social:
                user = social.user
            else:
                user = User.objects.filter(email=email).first()
                if user is None:
                    first_name = claims.get("given_name", "")[:150]
                    last_name = claims.get("family_name", "")[:150]
                    user = User.objects.create_user(
                        email=email,
                        username=_build_unique_username(display_name or email.split("@")[0]),
                        first_name=first_name,
                        last_name=last_name,
                        password=None,
                    )
                    UserSettings.objects.create(user=user)
                social = SocialAccount.objects.create(
                    user=user,
                    provider=SocialAccount.PROVIDER_GOOGLE,
                    provider_user_id=google_sub,
                    email=email,
                    display_name=display_name,
                    avatar_url=avatar_url,
                    extra_data=claims,
                    last_login_at=timezone.now(),
                )
                linked = True

            social.email = email
            social.display_name = display_name
            social.avatar_url = avatar_url
            social.extra_data = claims
            social.last_login_at = timezone.now()
            social.save(
                update_fields=[
                    "email",
                    "display_name",
                    "avatar_url",
                    "extra_data",
                    "last_login_at",
                ]
            )

            from .models import SecurityEvent
            if linked:
                SecurityEvent.objects.create(
                    user=user,
                    event_type="social_account_linked",
                    description="Google account linked",
                    metadata={"provider": "google", "social_account_id": str(social.id)},
                )

        if user.account_locked_at:
            return Response(
                {"detail": "Account is locked. Please contact support."},
                status=status.HTTP_403_FORBIDDEN,
            )

        tokens = _create_login_session_and_tokens(
            user=user,
            request=request,
            authentication_method="google",
            login_description="Login via Google",
            metadata={"provider": "google", "social_account_id": str(social.id)},
        )
        tokens["linked"] = linked
        return Response(tokens, status=status.HTTP_200_OK)


class SocialAccountsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        accounts = request.user.social_accounts.all().order_by("provider", "linked_at")
        data = [
            {
                "id": str(account.id),
                "provider": account.provider,
                "email": account.email,
                "display_name": account.display_name,
                "avatar_url": account.avatar_url,
                "linked_at": account.linked_at,
                "last_login_at": account.last_login_at,
            }
            for account in accounts
        ]
        return Response({"results": data}, status=status.HTTP_200_OK)


class GoogleLinkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        google_token = request.data.get("id_token")
        if not google_token:
            return Response(
                {"detail": "id_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            claims = _verify_google_token(google_token)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        google_sub = claims["sub"]
        email = claims["email"].strip().lower()
        display_name = claims.get("name") or email.split("@")[0]
        avatar_url = claims.get("picture")
        user = request.user

        existing = SocialAccount.objects.filter(
            provider=SocialAccount.PROVIDER_GOOGLE,
            provider_user_id=google_sub,
        ).first()
        if existing and existing.user_id != user.id:
            return Response(
                {"detail": "This Google account is already linked to another user."},
                status=status.HTTP_409_CONFLICT,
            )

        social, _ = SocialAccount.objects.update_or_create(
            user=user,
            provider=SocialAccount.PROVIDER_GOOGLE,
            defaults={
                "provider_user_id": google_sub,
                "email": email,
                "display_name": display_name,
                "avatar_url": avatar_url,
                "extra_data": claims,
                "last_login_at": timezone.now(),
            },
        )

        from .models import SecurityEvent
        SecurityEvent.objects.create(
            user=user,
            event_type="social_account_linked",
            description="Google account linked",
            metadata={"provider": "google", "social_account_id": str(social.id)},
        )

        return Response(
            {
                "detail": "Google account linked successfully.",
                "social_account_id": str(social.id),
            },
            status=status.HTTP_200_OK,
        )


class GoogleUnlinkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        social = SocialAccount.objects.filter(
            user=user,
            provider=SocialAccount.PROVIDER_GOOGLE,
        ).first()
        if social is None:
            return Response(
                {"detail": "Google account is not linked."},
                status=status.HTTP_404_NOT_FOUND,
            )

        other_social_count = user.social_accounts.exclude(id=social.id).count()
        if not user.has_usable_password() and not user.has_passkey and other_social_count == 0:
            return Response(
                {
                    "detail": "Cannot unlink the only login method. Add a password or passkey first."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        social_id = str(social.id)
        social.delete()

        from .models import SecurityEvent
        SecurityEvent.objects.create(
            user=user,
            event_type="social_account_unlinked",
            description="Google account unlinked",
            metadata={"provider": "google", "social_account_id": social_id},
        )

        return Response(
            {"detail": "Google account unlinked successfully."},
            status=status.HTTP_200_OK,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def LogoutView(request):
    try:
        refresh_token = request.data.get("refresh_token")
        token = RefreshToken(refresh_token)
        token.blacklist()

        from .models import SecurityEvent, Session
        from .device_utils import get_client_ip, get_user_agent

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        current_token_jti = None
        if auth_header.startswith("Bearer "):
            try:
                untyped_token = UntypedToken(auth_header.split(" ")[1])
                current_token_jti = untyped_token.get("jti")
            except (InvalidToken, TokenError, KeyError):
                pass

        if current_token_jti:
            Session.objects.filter(
                user=request.user,
                token_jti=current_token_jti,
                revoked_at__isnull=True,
            ).update(revoked_at=timezone.now())

        SecurityEvent.objects.create(
            user=request.user,
            event_type="logout",
            description="User logged out",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
        return Response(
            {"detail": "logout successful"}, status=status.HTTP_205_RESET_CONTENT
        )
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AccountDeletionRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user

        # Prevent duplicate requests
        if AccountDeletionRequest.objects.filter(user=user).exists():
            return Response(
                {"detail": "An account deletion request has already been submitted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create the deletion request
        AccountDeletionRequest.objects.create(user=user)

        # Send email confirmation
        try:
            from .emails import send_account_deletion_confirmation_email

            send_account_deletion_confirmation_email(user)
        except Exception as e:
            # Log but don't fail the request if email fails
            print(f"Failed to send deletion confirmation email: {e}")

        return Response(
            {
                "detail": "Your account deletion request has been received and will be processed."
            },
            status=status.HTTP_200_OK,
        )


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


class UserView(SlugOrIdLookupMixin, ModelViewSet):
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

    def get(self, request, user_id=None, user_ref=None):
        viewer = request.user
        lookup = user_ref or user_id
        try:
            target = User.objects.select_related("user_settings").get(slug=lookup)
        except User.DoesNotExist:
            try:
                target = User.objects.select_related("user_settings").get(id=lookup)
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

        # Only count personal posts (author_type="user"), exclude page posts
        allowed_posts_qs = Post.objects.filter(
            author=target, deleted_at__isnull=True, author_type="user"
        )
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
            "slug": target.slug,
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
        bio = request.data.get("bio")
        if bio is not None:
            decision = precheck_text_or_raise(
                text=str(bio),
                actor=request.user,
                context="user_profile_update",
            )
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if bio is not None:
            record_text_classification(
                content_object=user,
                actor=request.user,
                decision=decision,
                metadata={"context": "user_profile_update"},
            )
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance != request.user:
            return Response(
                {"detail": "Not authorized to update this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        bio = request.data.get("bio")
        if bio is not None:
            decision = precheck_text_or_raise(
                text=str(bio),
                actor=request.user,
                context="user_profile_update",
            )
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if bio is not None:
            record_text_classification(
                content_object=user,
                actor=request.user,
                decision=decision,
                metadata={"context": "user_profile_update"},
            )
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

            # Track the removal for the current user
            FriendshipHistory.objects.create(
                user=request.user,
                friend=friend,
                action="removed",
                removal_reason="unfriended_by_user",
            )

            # Track the removal for the friend (they lost us as a friend)
            FriendshipHistory.objects.create(
                user=friend,
                friend=request.user,
                action="removed",
                removal_reason="unfriended_by_friend",
            )
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
        dismissed_ids = DismissedSuggestion.objects.filter(user=user).values_list(
            "dismissed_user_id", flat=True
        )

        exclude_ids = (
            set(friend_ids)
            | set(reverse_friend_ids)
            | set(sent_requests)
            | set(incoming_requests)
            | set(blocked_ids)
            | set(blocked_me_ids)
            | set(dismissed_ids)
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

            # Track the addition for both users
            FriendshipHistory.objects.get_or_create(
                user=friend_request.from_user,
                friend=friend_request.to_user,
                action="added",
            )
            FriendshipHistory.objects.get_or_create(
                user=friend_request.to_user,
                friend=friend_request.from_user,
                action="added",
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


class DismissedSuggestionViewset(ModelViewSet):
    queryset = DismissedSuggestion.objects.all()
    permission_classes = [IsAuthenticated]
    http_method_names = ["post", "delete"]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        user = request.user
        dismissed_user_id = request.data.get("dismissed_user_id")

        if not dismissed_user_id:
            return Response(
                {"detail": "dismissed_user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            dismissed_user = User.objects.get(id=dismissed_user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if dismissed_user.id == user.id:
            return Response(
                {"detail": "Cannot dismiss yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dismissed_suggestion, created = DismissedSuggestion.objects.get_or_create(
            user=user, dismissed_user=dismissed_user
        )

        if created:
            return Response(
                {"detail": "Suggestion dismissed."}, status=status.HTTP_201_CREATED
            )
        else:
            return Response(
                {"detail": "Suggestion already dismissed."}, status=status.HTTP_200_OK
            )

    def destroy(self, request, *args, **kwargs):
        dismissed_user_id = request.data.get("dismissed_user_id") or kwargs.get("pk")

        if not dismissed_user_id:
            return Response(
                {"detail": "dismissed_user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            dismissed_suggestion = DismissedSuggestion.objects.get(
                user=request.user, dismissed_user_id=dismissed_user_id
            )
            dismissed_suggestion.delete()
            return Response({"detail": "Dismissal removed."}, status=status.HTTP_200_OK)
        except DismissedSuggestion.DoesNotExist:
            return Response(
                {"detail": "Dismissed suggestion not found."},
                status=status.HTTP_404_NOT_FOUND,
            )


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


class UserMetricsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        now = timezone.now()
        last_24_hours = now - timedelta(hours=24)
        last_7_days = now - timedelta(days=7)
        last_30_days = now - timedelta(days=30)
        last_12_months = now - timedelta(days=365)

        total_users = User.objects.count()
        new_last_24_hours = User.objects.filter(date_joined__gte=last_24_hours).count()
        new_last_7_days = User.objects.filter(date_joined__gte=last_7_days).count()
        new_last_30_days = User.objects.filter(date_joined__gte=last_30_days).count()

        # Count users who have created at least one post (shows engagement)
        from main.models import Post
        users_with_posts = Post.objects.filter(
            deleted_at__isnull=True,
            author_type="user"
        ).values('author').distinct().count()

        signups_per_day_qs = (
            User.objects.filter(date_joined__gte=now - timedelta(days=14))
            .annotate(day=TruncDate("date_joined"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        signups_per_day = [
            {"date": entry["day"].isoformat(), "count": entry["count"]}
            for entry in signups_per_day_qs
        ]

        signups_per_month_qs = (
            User.objects.filter(date_joined__gte=last_12_months)
            .annotate(month=TruncMonth("date_joined"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )
        signups_per_month = [
            {
                "month": entry["month"].date().replace(day=1).isoformat(),
                "count": entry["count"],
            }
            for entry in signups_per_month_qs
        ]

        return Response(
            {
                "generated_at": now.isoformat(),
                "totals": {"users": total_users},
                "new_users": {
                    "last_24_hours": new_last_24_hours,
                    "last_7_days": new_last_7_days,
                    "last_30_days": new_last_30_days,
                },
                "users_with_posts": users_with_posts,
                "signups_per_day": signups_per_day,
                "signups_per_month": signups_per_month,
            }
        )


class FriendshipHistoryViewSet(ModelViewSet):
    """ViewSet for viewing friendship history (added/removed friends)"""

    serializer_class = FriendshipHistorySerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get"]

    def get_queryset(self):
        """Get friendship history for the current user"""
        return FriendshipHistory.objects.filter(user=self.request.user).select_related(
            "friend"
        )

    @action(detail=False, methods=["get"])
    def new_friends(self, request):
        """Get recently added friends (last 30 days)"""
        from datetime import timedelta
        from django.utils import timezone

        thirty_days_ago = timezone.now() - timedelta(days=30)
        invites = FriendshipHistory.objects.filter(
            user=request.user,
            action="added",
            created_at__gte=thirty_days_ago,
        ).select_related("friend")
        serializer = self.get_serializer(invites, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def former_friends(self, request):
        """Get recently removed friends (unfriended or deleted by them)"""
        from datetime import timedelta
        from django.utils import timezone

        thirty_days_ago = timezone.now() - timedelta(days=30)
        removals = FriendshipHistory.objects.filter(
            user=request.user,
            action="removed",
            created_at__gte=thirty_days_ago,
        ).select_related("friend")
        serializer = self.get_serializer(removals, many=True)
        return Response(serializer.data)


class OnlineUsersView(APIView):
    """View for fetching currently online users"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get list of currently online users"""
        online_users = User.objects.filter(is_online=True).exclude(id=request.user.id)
        serializer = UserStatusSerializer(online_users, many=True)
        return Response(serializer.data)
