"""
Middleware to track user activity and update last_seen/last_activity timestamps.
"""

import logging
from django.utils import timezone
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


class UserActivityMiddleware:
    """
    Middleware that updates user's last_activity and last_seen timestamps
    on each authenticated API request.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        self._update_user_activity(request)
        return response

    def _update_user_activity(self, request):
        """Update user activity timestamp if authenticated."""
        user = request.user

        # Skip if user is anonymous or not authenticated
        if not user or isinstance(user, AnonymousUser) or user.is_anonymous:
            return

        # Skip non-API requests and health checks
        if not request.path.startswith("/api/"):
            return

        # Skip certain endpoints that don't indicate real activity
        skip_paths = [
            "/api/schema",
            "/api/auth/user/",  # User fetch to check auth status
        ]

        if any(request.path.startswith(path) for path in skip_paths):
            return

        try:
            # Update only the activity fields without triggering other signals
            from django.contrib.auth import get_user_model

            User = get_user_model()

            now = timezone.now()
            User.objects.filter(id=user.id).update(last_activity=now, last_seen=now)
            
            # Update current session's last_activity (Phase 2)
            try:
                from rest_framework_simplejwt.tokens import UntypedToken
                from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
                from users.models import Session
                
                auth_header = request.META.get("HTTP_AUTHORIZATION", "")
                if auth_header.startswith("Bearer "):
                    current_token = auth_header.split(" ")[1]
                    try:
                        untyped_token = UntypedToken(current_token)
                        token_jti = untyped_token.get("jti")
                        if token_jti:
                            Session.objects.filter(user=user, token_jti=token_jti, revoked_at__isnull=True).update(
                                last_activity=now
                            )
                    except (InvalidToken, TokenError, KeyError):
                        pass  # If we can't decode token, skip session update
            except Exception as e:
                logger.debug(f"Failed to update session activity: {e}")
            
            logger.debug(f"Updated activity for user {user.id} on {request.path}")
        except Exception as e:
            logger.exception(f"Failed to update user activity: {e}")
