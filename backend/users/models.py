from typing import Iterable
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.base_user import BaseUserManager
from uuid import uuid4

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

    # Online status tracking
    is_online = models.BooleanField(_("Is Online"), default=False)
    last_seen = models.DateTimeField(
        _("Last Seen"), auto_now_add=False, null=True, blank=True
    )
    last_activity = models.DateTimeField(
        _("Last Activity"), auto_now_add=False, null=True, blank=True
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    objects = CustomUserManager()

    def __str__(self) -> str:
        return self.email


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
