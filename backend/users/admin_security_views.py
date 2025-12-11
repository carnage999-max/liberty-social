"""
Admin Security Views (Phase 3)
"""

import logging
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser

from .models import User, PasskeyCredential, Session, SessionHistory, SecurityEvent
from .device_utils import get_client_ip, get_user_agent

logger = logging.getLogger(__name__)


class UserSecurityView(APIView):
    """Get security status for a user (admin only)."""

    permission_classes = [IsAdminUser]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            
            # Get device count
            active_devices = user.passkey_credentials.filter(device_removed_at__isnull=True).count()
            
            # Get active session count
            active_sessions = user.sessions.filter(revoked_at__isnull=True).count()
            
            # Get recent security events
            recent_events = user.security_events.all().order_by("-created_at")[:10]
            
            return Response(
                {
                    "user_id": str(user.id),
                    "email": user.email,
                    "has_passkey": user.has_passkey,
                    "active_devices": active_devices,
                    "active_sessions": active_sessions,
                    "account_locked": user.account_locked_at is not None,
                    "account_locked_at": user.account_locked_at.isoformat() if user.account_locked_at else None,
                    "locked_reason": user.locked_reason,
                    "recent_events": [
                        {
                            "event_type": event.event_type,
                            "description": event.description,
                            "ip_address": event.ip_address,
                            "created_at": event.created_at.isoformat(),
                        }
                        for event in recent_events
                    ],
                },
                status=status.HTTP_200_OK,
            )
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


class UserDevicesView(APIView):
    """Get devices for a user (admin only, read-only)."""

    permission_classes = [IsAdminUser]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
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
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


class UserActivityView(APIView):
    """Get activity log for a user (admin only)."""

    permission_classes = [IsAdminUser]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
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
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


class UserLockView(APIView):
    """Lock a user account (admin only)."""

    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            reason = request.data.get("reason", "Locked by administrator")
            
            if user.account_locked_at:
                return Response(
                    {"error": "Account is already locked"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            user.account_locked_at = timezone.now()
            user.locked_reason = reason
            user.save(update_fields=["account_locked_at", "locked_reason"])
            
            # Revoke all active sessions
            user.sessions.filter(revoked_at__isnull=True).update(revoked_at=timezone.now())
            
            # Log security event
            SecurityEvent.objects.create(
                user=user,
                event_type="account_locked",
                description=f"Account locked by admin: {reason}",
                ip_address=get_client_ip(request),
                user_agent=get_user_agent(request),
                metadata={"locked_by": str(request.user.id), "reason": reason},
            )
            
            logger.info(f"Account {user.id} locked by admin {request.user.id}")
            
            return Response(
                {
                    "success": True,
                    "message": "Account locked successfully",
                    "locked_at": user.account_locked_at.isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


class UserUnlockView(APIView):
    """Unlock a user account (admin only)."""

    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            
            if not user.account_locked_at:
                return Response(
                    {"error": "Account is not locked"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            old_reason = user.locked_reason
            user.account_locked_at = None
            user.locked_reason = None
            user.save(update_fields=["account_locked_at", "locked_reason"])
            
            # Log security event
            SecurityEvent.objects.create(
                user=user,
                event_type="account_unlocked",
                description=f"Account unlocked by admin. Previous reason: {old_reason}",
                ip_address=get_client_ip(request),
                user_agent=get_user_agent(request),
                metadata={"unlocked_by": str(request.user.id), "previous_reason": old_reason},
            )
            
            logger.info(f"Account {user.id} unlocked by admin {request.user.id}")
            
            return Response(
                {
                    "success": True,
                    "message": "Account unlocked successfully",
                },
                status=status.HTTP_200_OK,
            )
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

