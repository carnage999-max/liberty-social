from typing import Iterable
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.base_user import BaseUserManager
from uuid import uuid4

# USER MODEL DEFINITION
GENDER = (
    ('--Select Gender--', '--Select Gender--'),
    ('male', 'Male'),
    ('female', 'Female')
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
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(
                "Superuser must have is_staff=True "
            )
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(
                "Superuser must have is_superuser=True"
            )

        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    id = models.UUIDField(_("User ID"), primary_key=True, unique=True, default=uuid4, editable=False)
    username = models.CharField(_("Display Name"), unique=True, max_length=200, blank=True, null=True)
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
    
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    objects = CustomUserManager()
    
    def __str__(self) -> str:
        return self.email
    
    
class UserSettings(models.Model):
    PRIVACY_CHOICES = (
        ("public", "public"),
        ("private", "private"),
        ("only_me", "only_me")
    )
    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="user_settings")
    profile_privacy = models.CharField(_("Privacy status"), choices=PRIVACY_CHOICES, max_length=10, default="public")
    friends_publicity = models.CharField(_("Friends Publicity"), choices=PRIVACY_CHOICES, default="public")
    
    
    def __str__(self) -> str:
        return f"Settings for {self.user}"
    
class FriendRequest(models.Model):
    from_user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="sent_friend_requests")
    to_user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="received_friend_requests")
    status = models.CharField(max_length=12, choices=(('pending', 'pending'), ('accepted', 'accepted'), ('declined', 'declined')), default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.from_user} -> {self.to_user} ({self.status})"
    
class Friends(models.Model):
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="user_friends")
    friend = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="friends_of")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (('user', 'friend'),)
        indexes = [models.Index(fields=['user', 'friend'])]

    def __str__(self) -> str:
        return f"{self.user} <-> {self.friend}"

    @classmethod
    def friends_count(cls, user):
        return cls.objects.filter(user=user).count()
    
class BlockedUsers(models.Model):
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name='blocked_users')
    blocked_user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name='blocked_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (('user', 'blocked_user'),)

    def __str__(self) -> str:
        return f"{self.user} blocked {self.blocked_user}"


class DismissedSuggestion(models.Model):
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name='dismissed_suggestions')
    dismissed_user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name='dismissed_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (('user', 'dismissed_user'),)
        indexes = [models.Index(fields=['user', 'dismissed_user'])]

    def __str__(self) -> str:
        return f"{self.user} dismissed {self.dismissed_user}"
