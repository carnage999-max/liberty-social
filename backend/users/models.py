from typing import Iterable
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.base_user import BaseUserManager
from uuid import uuid4

from main.slug_utils import unique_slugify

# USER MODEL DEFINITION
GENDER = (
    ("--Select Gender--", "--Select Gender--"),
    ("male", "Male"),
    ("female", "Female"),
)


class CustomUserManager(BaseUserManager):
    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("The given email must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self.db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True ")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    id = models.UUIDField(
        _("User ID"), primary_key=True, unique=True, default=uuid4, editable=False
    )
    username = models.CharField(
        _("Display Name"), unique=True, max_length=200, blank=True, null=True
    )
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    email = models.EmailField(
        _("email address"),
        unique=True,
        error_messages={
            "unique": _("A user with that email already exists."),
        },
    )
    phone_number = models.CharField(max_length=13, null=True)
    profile_image_url = models.URLField(_("Display Picture"), null=True, blank=True)
    bio = models.TextField(_("Bio"), null=True, blank=True)
    gender = models.CharField(_("Gender"), max_length=50, default="Not specified")

    # Location and demographic data
    age = models.IntegerField(_("Age"), null=True, blank=True)
    country = models.CharField(_("Country"), max_length=100, null=True, blank=True)
    state = models.CharField(_("State/Province"), max_length=100, null=True, blank=True)
    city = models.CharField(_("City"), max_length=100, null=True, blank=True)

    # Online status tracking
    is_online = models.BooleanField(_("Is Online"), default=False)
    last_seen = models.DateTimeField(
        _("Last Seen"), auto_now_add=False, null=True, blank=True
    )
    last_activity = models.DateTimeField(
        _("Last Activity"), auto_now_add=False, null=True, blank=True
    )

    # Passkey support
    has_passkey = models.BooleanField(
        _("Has Passkey"),
        default=False,
        help_text="Whether user has registered a passkey",
    )

    # Account lock (Phase 3)
    account_locked_at = models.DateTimeField(
        _("Account Locked At"),
        null=True,
        blank=True,
        help_text="When the account was locked",
    )
    locked_reason = models.TextField(
        _("Locked Reason"),
        blank=True,
        null=True,
        help_text="Reason for account lock",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    objects = CustomUserManager()

    def __str__(self) -> str:
        return self.email

    def save(self, *args, **kwargs):
        if not self.slug:
            base = self.username or self.email or "user"
            self.slug = unique_slugify(self.__class__, base, fallback="user")
        super().save(*args, **kwargs)


class AccountDeletionRequest(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="deletion_request"
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    is_processed = models.BooleanField(default=False)

    def __str__(self):
        return f"Deletion request for {self.user.email}"


class UserSettings(models.Model):
    PRIVACY_CHOICES = (
        ("public", "public"),
        ("private", "private"),
        ("only_me", "only_me"),
    )
    user = models.OneToOneField(
        "users.User", on_delete=models.CASCADE, related_name="user_settings"
    )
    profile_privacy = models.CharField(
        _("Privacy status"), choices=PRIVACY_CHOICES, max_length=10, default="public"
    )
    friends_publicity = models.CharField(
        _("Friends Publicity"), choices=PRIVACY_CHOICES, default="public"
    )

    def __str__(self) -> str:
        return f"Settings for {self.user}"


class FriendRequest(models.Model):
    from_user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="sent_friend_requests"
    )
    to_user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="received_friend_requests"
    )
    status = models.CharField(
        max_length=12,
        choices=(
            ("pending", "pending"),
            ("accepted", "accepted"),
            ("declined", "declined"),
        ),
        default="pending",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.from_user} -> {self.to_user} ({self.status})"


class Friends(models.Model):
    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="user_friends"
    )
    friend = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="friends_of"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("user", "friend"),)
        indexes = [models.Index(fields=["user", "friend"])]

    def __str__(self) -> str:
        return f"{self.user} <-> {self.friend}"

    @classmethod
    def friends_count(cls, user):
        return cls.objects.filter(user=user).count()


class BlockedUsers(models.Model):
    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="blocked_users"
    )
    blocked_user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="blocked_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("user", "blocked_user"),)

    def __str__(self) -> str:
        return f"{self.user} blocked {self.blocked_user}"


class DismissedSuggestion(models.Model):
    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="dismissed_suggestions"
    )
    dismissed_user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="dismissed_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("user", "dismissed_user"),)
        indexes = [models.Index(fields=["user", "dismissed_user"])]

    def __str__(self) -> str:
        return f"{self.user} dismissed {self.dismissed_user}"


class FriendshipHistory(models.Model):
    """Track additions and removals of friends to show friend changes history"""

    ACTION_CHOICES = (
        ("added", "Added"),
        ("removed", "Removed"),
    )

    REMOVAL_REASON_CHOICES = (
        ("unfriended_by_user", "You unfriended them"),
        ("unfriended_by_friend", "They unfriended you"),
        ("both_mutual", "Mutual removal"),
    )

    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="friendship_history_user"
    )
    friend = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="friendship_history_friend"
    )
    action = models.CharField(
        max_length=20, choices=ACTION_CHOICES
    )  # "added" or "removed"
    removal_reason = models.CharField(
        max_length=30,
        choices=REMOVAL_REASON_CHOICES,
        null=True,
        blank=True,
        help_text="Only filled when action is 'removed'",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "action"]),
        ]
        verbose_name_plural = "Friendship Histories"

    def __str__(self) -> str:
        return f"{self.user} {self.action} {self.friend} ({self.get_action_display()})"


class PasskeyCredential(models.Model):
    """Stores WebAuthn passkey credentials for users."""

    id = models.UUIDField(
        _("Credential ID"), primary_key=True, unique=True, default=uuid4, editable=False
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="passkey_credentials",
        help_text="User who owns this passkey",
    )
    credential_id = models.TextField(
        _("Credential ID"),
        unique=True,
        help_text="Base64-encoded credential ID from WebAuthn",
        db_index=True,
    )
    public_key = models.TextField(
        _("Public Key"),
        help_text="Base64-encoded public key from WebAuthn",
    )
    sign_count = models.BigIntegerField(
        _("Sign Count"),
        default=0,
        help_text="Number of times this credential has been used",
    )
    device_name = models.CharField(
        _("Device Name"),
        max_length=200,
        blank=True,
        null=True,
        help_text="User-friendly name for the device (e.g., 'iPhone 15', 'Chrome on Mac')",
    )
    device_info = models.JSONField(
        _("Device Info"),
        default=dict,
        blank=True,
        help_text="Additional device information (OS, browser, user agent, etc.)",
    )
    ip_address = models.GenericIPAddressField(
        _("IP Address"),
        null=True,
        blank=True,
        help_text="IP address when passkey was registered",
    )
    location = models.CharField(
        _("Location"),
        max_length=200,
        blank=True,
        null=True,
        help_text="Approximate location (city, country) when registered",
    )
    last_seen_ip = models.GenericIPAddressField(
        _("Last Seen IP"),
        null=True,
        blank=True,
        help_text="IP address from last authentication",
    )
    last_seen_location = models.CharField(
        _("Last Seen Location"),
        max_length=200,
        blank=True,
        null=True,
        help_text="Location from last authentication",
    )
    created_at = models.DateTimeField(_("Created At"), auto_now_add=True)
    last_used_at = models.DateTimeField(
        _("Last Used At"),
        null=True,
        blank=True,
        help_text="When this passkey was last used",
    )
    device_removed_at = models.DateTimeField(
        _("Device Removed At"),
        null=True,
        blank=True,
        help_text="When this device was removed (soft delete)",
    )

    class Meta:
        verbose_name = _("Passkey Credential")
        verbose_name_plural = _("Passkey Credentials")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["credential_id"]),
        ]

    def __str__(self) -> str:
        device_name = self.device_name or "Unknown Device"
        return f"Passkey for {self.user.email} on {device_name}"


class Session(models.Model):
    """Tracks active user sessions (JWT tokens)."""

    id = models.UUIDField(
        _("Session ID"), primary_key=True, unique=True, default=uuid4, editable=False
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sessions",
        help_text="User who owns this session",
    )
    device_id = models.UUIDField(
        _("Device ID"),
        null=True,
        blank=True,
        help_text="Associated passkey credential ID if authenticated via passkey",
    )
    device_name = models.CharField(
        _("Device Name"),
        max_length=200,
        blank=True,
        null=True,
        help_text="Device name from passkey or user agent",
    )
    ip_address = models.GenericIPAddressField(
        _("IP Address"),
        null=True,
        blank=True,
        help_text="IP address when session was created",
    )
    location = models.CharField(
        _("Location"),
        max_length=200,
        blank=True,
        null=True,
        help_text="Approximate location (city, country)",
    )
    user_agent = models.TextField(
        _("User Agent"),
        blank=True,
        null=True,
        help_text="Browser/client user agent string",
    )
    token_jti = models.CharField(
        _("Token JTI"),
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        help_text="JWT access token ID (jti) to identify the session",
    )
    refresh_token_jti = models.CharField(
        _("Refresh Token JTI"),
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        help_text="JWT refresh token ID (jti) to blacklist tokens when revoking sessions",
    )
    created_at = models.DateTimeField(_("Created At"), auto_now_add=True)
    last_activity = models.DateTimeField(
        _("Last Activity"), auto_now=True, help_text="Last time this session was used"
    )
    revoked_at = models.DateTimeField(
        _("Revoked At"),
        null=True,
        blank=True,
        help_text="When this session was revoked",
    )

    class Meta:
        verbose_name = _("Session")
        verbose_name_plural = _("Sessions")
        ordering = ["-last_activity"]
        indexes = [
            models.Index(fields=["user", "-last_activity"]),
            models.Index(fields=["device_id"]),
        ]

    def __str__(self) -> str:
        device = self.device_name or "Unknown Device"
        return f"Session for {self.user.email} on {device}"


class SessionHistory(models.Model):
    """Historical record of login sessions for activity log."""

    id = models.UUIDField(
        _("History ID"), primary_key=True, unique=True, default=uuid4, editable=False
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="session_history",
        help_text="User who logged in",
    )
    device_id = models.UUIDField(
        _("Device ID"),
        null=True,
        blank=True,
        help_text="Associated passkey credential ID if authenticated via passkey",
    )
    device_name = models.CharField(
        _("Device Name"),
        max_length=200,
        blank=True,
        null=True,
        help_text="Device name",
    )
    ip_address = models.GenericIPAddressField(
        _("IP Address"),
        null=True,
        blank=True,
        help_text="IP address when login occurred",
    )
    location = models.CharField(
        _("Location"),
        max_length=200,
        blank=True,
        null=True,
        help_text="Approximate location (city, country)",
    )
    user_agent = models.TextField(
        _("User Agent"),
        blank=True,
        null=True,
        help_text="Browser/client user agent string",
    )
    authentication_method = models.CharField(
        _("Authentication Method"),
        max_length=50,
        choices=[
            ("password", "Password"),
            ("passkey", "Passkey"),
        ],
        default="password",
        help_text="Method used to authenticate",
    )
    created_at = models.DateTimeField(_("Created At"), auto_now_add=True)
    ended_at = models.DateTimeField(
        _("Ended At"),
        null=True,
        blank=True,
        help_text="When the session ended (logout or expiry)",
    )

    class Meta:
        verbose_name = _("Session History")
        verbose_name_plural = _("Session Histories")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self) -> str:
        method = self.authentication_method
        device = self.device_name or "Unknown Device"
        return f"{method.title()} login for {self.user.email} on {device}"


class SecurityEvent(models.Model):
    """Audit log for security-related events."""

    EVENT_TYPES = [
        ("login", "Login"),
        ("login_failed", "Login Failed"),
        ("logout", "Logout"),
        ("passkey_registered", "Passkey Registered"),
        ("passkey_removed", "Passkey Removed"),
        ("device_removed", "Device Removed"),
        ("session_revoked", "Session Revoked"),
        ("account_locked", "Account Locked"),
        ("account_unlocked", "Account Unlocked"),
        ("password_changed", "Password Changed"),
    ]

    id = models.UUIDField(
        _("Event ID"), primary_key=True, unique=True, default=uuid4, editable=False
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="security_events",
        null=True,
        blank=True,
        help_text="User associated with this event (null for system events)",
    )
    event_type = models.CharField(
        _("Event Type"),
        max_length=50,
        choices=EVENT_TYPES,
        help_text="Type of security event",
    )
    description = models.TextField(
        _("Description"),
        blank=True,
        help_text="Human-readable description of the event",
    )
    ip_address = models.GenericIPAddressField(
        _("IP Address"),
        null=True,
        blank=True,
        help_text="IP address where event occurred",
    )
    user_agent = models.TextField(
        _("User Agent"),
        blank=True,
        null=True,
        help_text="Browser/client user agent string",
    )
    metadata = models.JSONField(
        _("Metadata"),
        default=dict,
        blank=True,
        help_text="Additional event data (device_id, session_id, etc.)",
    )
    created_at = models.DateTimeField(_("Created At"), auto_now_add=True)

    class Meta:
        verbose_name = _("Security Event")
        verbose_name_plural = _("Security Events")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["event_type", "-created_at"]),
        ]

    def __str__(self) -> str:
        user_str = self.user.email if self.user else "System"
        return f"{self.get_event_type_display()} - {user_str} - {self.created_at}"
