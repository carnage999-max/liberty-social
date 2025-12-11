"""
Device and Session Management Views (Phase 2)
"""

import logging
from django.utils import timezone
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from .models import PasskeyCredential, Session, SessionHistory, SecurityEvent
from .device_utils import get_client_ip, get_user_agent, get_location_from_ip, extract_device_info

logger = logging.getLogger(__name__)


class DeviceListView(APIView):
    """List all devices (passkeys) for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Only show active devices (not removed)
        devices = user.passkey_credentials.filter(device_removed_at__isnull=True).order_by("-last_used_at", "-created_at")

        return Response(
            {
                "devices": [
                    {
                        "id": str(device.id),
                        "device_name": device.device_name,
                        "device_info": device.device_info,
                        "ip_address": device.ip_address,
                        "location": device.location,
                        "last_seen_ip": device.last_seen_ip,
                        "last_seen_location": device.last_seen_location,
                        "created_at": device.created_at.isoformat(),
                        "last_used_at": device.last_used_at.isoformat() if device.last_used_at else None,
                    }
                    for device in devices
                ],
            },
            status=status.HTTP_200_OK,
        )


class DeviceDetailView(APIView):
    """Get, update, or remove a specific device."""

    permission_classes = [IsAuthenticated]

    def get(self, request, device_id):
        user = request.user
        try:
            device = user.passkey_credentials.get(id=device_id, device_removed_at__isnull=True)
            return Response(
                {
                    "id": str(device.id),
                    "device_name": device.device_name,
                    "device_info": device.device_info,
                    "ip_address": device.ip_address,
                    "location": device.location,
                    "last_seen_ip": device.last_seen_ip,
                    "last_seen_location": device.last_seen_location,
                    "created_at": device.created_at.isoformat(),
                    "last_used_at": device.last_used_at.isoformat() if device.last_used_at else None,
                },
                status=status.HTTP_200_OK,
            )
        except PasskeyCredential.DoesNotExist:
            return Response(
                {"error": "Device not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

    def patch(self, request, device_id):
        """Update device name."""
        user = request.user
        try:
            device = user.passkey_credentials.get(id=device_id, device_removed_at__isnull=True)
            device_name = request.data.get("device_name")
            if device_name:
                device.device_name = device_name.strip()
                device.save(update_fields=["device_name"])

                # Log security event
                SecurityEvent.objects.create(
                    user=user,
                    event_type="device_removed",  # Actually device renamed, but we'll use this
                    description=f"Device renamed to: {device_name}",
                    ip_address=get_client_ip(request),
                    user_agent=get_user_agent(request),
                    metadata={"device_id": str(device.id), "old_name": device.device_name},
                )

                return Response(
                    {"success": True, "device_name": device.device_name},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": "device_name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except PasskeyCredential.DoesNotExist:
            return Response(
                {"error": "Device not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

    def delete(self, request, device_id):
        """Remove a device (soft delete - marks device_removed_at)."""
        user = request.user
        try:
            device = user.passkey_credentials.get(id=device_id, device_removed_at__isnull=True)

            # Check if this is the last device
            active_devices = user.passkey_credentials.filter(device_removed_at__isnull=True)
            if active_devices.count() <= 1:
                return Response(
                    {"error": "Cannot remove the last device. Please add another device first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Soft delete
            device.device_removed_at = timezone.now()
            device.save(update_fields=["device_removed_at"])

            # Update has_passkey flag if no active devices remain
            if not user.passkey_credentials.filter(device_removed_at__isnull=True).exists():
                user.has_passkey = False
                user.save(update_fields=["has_passkey"])

            # Revoke all sessions for this device
            Session.objects.filter(user=user, device_id=device.id, revoked_at__isnull=True).update(
                revoked_at=timezone.now()
            )

            # Log security event
            SecurityEvent.objects.create(
                user=user,
                event_type="device_removed",
                description=f"Device removed: {device.device_name}",
                ip_address=get_client_ip(request),
                user_agent=get_user_agent(request),
                metadata={"device_id": str(device.id), "device_name": device.device_name},
            )

            logger.info(f"Device {device_id} removed for user {user.id}")

            return Response(
                {"success": True, "message": "Device removed successfully"},
                status=status.HTTP_200_OK,
            )
        except PasskeyCredential.DoesNotExist:
            return Response(
                {"error": "Device not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


class SessionListView(APIView):
    """List all active sessions for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Get current token JTI
        current_token_jti = None
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            current_token = auth_header.split(" ")[1]
            try:
                from rest_framework_simplejwt.tokens import UntypedToken
                from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
                untyped_token = UntypedToken(current_token)
                current_token_jti = untyped_token.get("jti")
            except (InvalidToken, TokenError, KeyError):
                pass  # If we can't decode, continue without matching

        # Get active sessions (not revoked)
        sessions = Session.objects.filter(user=user, revoked_at__isnull=True).order_by("-last_activity")

        return Response(
            {
                "sessions": [
                    {
                        "id": str(session.id),
                        "device_id": str(session.device_id) if session.device_id else None,
                        "device_name": session.device_name,
                        "ip_address": session.ip_address,
                        "location": session.location,
                        "user_agent": session.user_agent,
                        "created_at": session.created_at.isoformat(),
                        "last_activity": session.last_activity.isoformat(),
                        "is_current": current_token_jti and session.token_jti == current_token_jti,
                    }
                    for session in sessions
                ],
            },
            status=status.HTTP_200_OK,
        )


class SessionRevokeAllView(APIView):
    """Revoke all sessions except the current one."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        # Get current token JTI to identify the current session
        current_token_jti = None
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            try:
                from rest_framework_simplejwt.tokens import UntypedToken
                from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
                
                token_str = auth_header.split(" ")[1]
                untyped_token = UntypedToken(token_str)
                current_token_jti = untyped_token.get("jti")
            except (InvalidToken, TokenError, Exception) as e:
                logger.warning(f"Failed to decode current access token for JTI: {e}")
        
        # Find the current session using token_jti
        current_session = None
        if current_token_jti:
            try:
                current_session = Session.objects.filter(
                    user=user, 
                    token_jti=current_token_jti,
                    revoked_at__isnull=True
                ).first()
            except Exception as e:
                logger.warning(f"Failed to find current session: {e}")
        
        # Revoke all sessions EXCEPT the current one
        if current_session:
            revoked_count = Session.objects.filter(
                user=user, 
                revoked_at__isnull=True
            ).exclude(id=current_session.id).update(revoked_at=timezone.now())
        else:
            # If we can't identify current session, revoke all (fallback)
            revoked_count = Session.objects.filter(
                user=user, 
                revoked_at__isnull=True
            ).update(revoked_at=timezone.now())
            logger.warning(f"Could not identify current session for user {user.id}, revoked all sessions")

        # Blacklist all outstanding JWT refresh tokens except the current one
        # Note: OutstandingToken tracks refresh tokens, not access tokens
        # When a refresh token is blacklisted, users won't be able to refresh their access tokens
        # Access tokens will still work until they expire (100 days), but users can't get new ones
        outstanding_tokens = OutstandingToken.objects.filter(user=user)
        blacklisted_count = 0
        
        # Get the current refresh token JTI from the session
        current_refresh_token_jti = None
        if current_session and current_session.refresh_token_jti:
            current_refresh_token_jti = current_session.refresh_token_jti
        
        # If we don't have it in the session, try to find it using a time-based heuristic
        if not current_refresh_token_jti and current_session and current_session.created_at:
            from datetime import timedelta
            time_window_start = current_session.created_at - timedelta(minutes=5)
            time_window_end = current_session.created_at + timedelta(minutes=5)
            
            recent_tokens = outstanding_tokens.filter(
                created_at__gte=time_window_start,
                created_at__lte=time_window_end
            )
            
            if recent_tokens.count() == 1:
                current_refresh_token_jti = recent_tokens.first().jti
        
        for token in outstanding_tokens:
            # Skip the current refresh token if we identified it
            if current_refresh_token_jti and str(token.jti) == str(current_refresh_token_jti):
                continue  # Skip current refresh token
            
            # Blacklist this refresh token
            # Users with blacklisted refresh tokens won't be able to get new access tokens
            try:
                BlacklistedToken.objects.get_or_create(token=token)
                blacklisted_count += 1
            except Exception as e:
                logger.warning(f"Failed to blacklist token {token.jti}: {e}")

        # Log security event
        SecurityEvent.objects.create(
            user=user,
            event_type="session_revoked",
            description=f"All sessions revoked (except current). {revoked_count} sessions, {blacklisted_count} tokens blacklisted.",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={
                "revoked_sessions": revoked_count,
                "blacklisted_tokens": blacklisted_count,
                "current_session_id": str(current_session.id) if current_session else None,
            },
        )

        logger.info(f"All sessions revoked for user {user.id}: {revoked_count} sessions, {blacklisted_count} tokens blacklisted")

        return Response(
            {
                "success": True,
                "message": f"Revoked {revoked_count} sessions and blacklisted {blacklisted_count} tokens",
            },
            status=status.HTTP_200_OK,
        )


class ActivityLogView(APIView):
    """Get activity log (session history) for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))

        history = user.session_history.all().order_by("-created_at")[offset : offset + limit]

        return Response(
            {
                "activity": [
                    {
                        "id": str(entry.id),
                        "device_id": str(entry.device_id) if entry.device_id else None,
                        "device_name": entry.device_name,
                        "ip_address": entry.ip_address,
                        "location": entry.location,
                        "user_agent": entry.user_agent,
                        "authentication_method": entry.authentication_method,
                        "created_at": entry.created_at.isoformat(),
                        "ended_at": entry.ended_at.isoformat() if entry.ended_at else None,
                    }
                    for entry in history
                ],
                "count": user.session_history.count(),
            },
            status=status.HTTP_200_OK,
        )

