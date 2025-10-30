from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import BlockedUsers, Friends, User


class IsBlocked(BasePermission):
    """
    Custom permission to only allow actions if the user is not blocked by or has not blocked the target user.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not getattr(user, 'is_authenticated', False):
            return False

        # Helper: try to get a target User instance from common related names
        target_user = None
        if hasattr(obj, 'to_user'):
            target_user = getattr(obj, 'to_user')
        elif hasattr(obj, 'friend'):
            target_user = getattr(obj, 'friend')
        elif hasattr(obj, 'blocked_user'):
            target_user = getattr(obj, 'blocked_user')
        elif hasattr(obj, 'from_user'):
            target_user = getattr(obj, 'from_user')

        if target_user is None:
            return False

        # Check if the user has blocked the target user
        if BlockedUsers.objects.filter(user=user, blocked_user=target_user).exists():
            return False

        # Check if the target user has blocked the user
        if BlockedUsers.objects.filter(user=target_user, blocked_user=user).exists():
            return False

        return True
class IsFriend(BasePermission):
    """
    Custom permission to only allow actions if the user is friends with the target user.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not getattr(user, "is_authenticated", False):
            return False

        # Prefer getattr for clarity; normalize to an id
        # resolve target user instance
        target = None
        if hasattr(obj, 'to_user'):
            target = getattr(obj, 'to_user')
        elif hasattr(obj, 'friend'):
            target = getattr(obj, 'friend')
        elif hasattr(obj, 'blocked_user'):
            target = getattr(obj, 'blocked_user')
        elif hasattr(obj, 'from_user'):
            target = getattr(obj, 'from_user')

        if target is None:
            return False

        return Friends.objects.filter(user=user, friend=target).exists()
