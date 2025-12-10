"""
WebAuthn Passkey Authentication Views

Implements Phase 1: Core Passkey Support (MVP)
- Passkey registration (WebAuthn create)
- Passkey authentication (WebAuthn get)
- Passkey status check
- Passkey removal
"""

import json
import base64
import logging
from typing import Dict, Any

from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from webauthn.helpers.structs import (
    PublicKeyCredentialDescriptor,
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    UserVerificationRequirement,
    RegistrationCredential,
    AuthenticationCredential,
)

from .models import User, PasskeyCredential

logger = logging.getLogger(__name__)


def get_rp_id(request=None) -> str:
    """Get the Relying Party ID for WebAuthn (domain without protocol/port)."""
    # If request is provided, try to use the Origin header (for development/testing)
    if request:
        origin = request.META.get("HTTP_ORIGIN")
        if origin:
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            hostname = parsed.hostname
            if hostname:
                # Allow localhost for development
                if hostname in ["localhost", "127.0.0.1"]:
                    return hostname
                # For production, validate against allowed origins
                allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
                # CORS_ALLOWED_ORIGINS can be a list or a string (depending on config)
                if isinstance(allowed_origins, str):
                    allowed_origins = [o.strip() for o in allowed_origins.split(",")]
                # Check if origin contains this hostname or if hostname matches
                for allowed_origin in allowed_origins:
                    if hostname in allowed_origin or origin == allowed_origin:
                        return hostname
    
    # Fallback to FRONTEND_URL setting
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    from urllib.parse import urlparse
    parsed = urlparse(frontend_url)
    rp_id = parsed.hostname or "localhost"
    # Remove port if present
    if ":" in rp_id:
        rp_id = rp_id.split(":")[0]
    return rp_id


def get_rp_origin(request=None) -> str:
    """Get the Relying Party Origin for WebAuthn."""
    # If request is provided, try to use the Origin header (for development/testing)
    if request:
        origin = request.META.get("HTTP_ORIGIN")
        if origin:
            origin = origin.rstrip("/")
            # Allow localhost for development
            if "localhost" in origin or "127.0.0.1" in origin:
                return origin
            # For production, validate against allowed origins
            allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
            # CORS_ALLOWED_ORIGINS can be a list or a string (depending on config)
            if isinstance(allowed_origins, str):
                allowed_origins = [o.strip() for o in allowed_origins.split(",")]
            # Check if origin is in allowed origins
            if origin in allowed_origins:
                return origin
    
    # Fallback to FRONTEND_URL setting
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    return frontend_url.rstrip("/")


class PasskeyRegisterBeginView(APIView):
    """
    Begin passkey registration (WebAuthn create).
    Returns challenge and options for the client to create a credential.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # Get device info from request
        device_name = request.data.get("device_name", "")
        device_info = request.data.get("device_info", {})

        try:
            # Generate registration options
            rp_id = get_rp_id(request)
            rp_origin = get_rp_origin(request)
            
            logger.info(
                f"Passkey registration begin - RP ID: {rp_id}, RP Origin: {rp_origin}, "
                f"Request Origin: {request.META.get('HTTP_ORIGIN', 'N/A')}"
            )

            registration_options = generate_registration_options(
                rp_id=rp_id,
                rp_name="Liberty Social",
                user_id=bytes(str(user.id), "utf-8"),
                user_name=user.email,
                user_display_name=user.get_full_name() or user.username or user.email,
                # Allow both platform and cross-platform authenticators
                authenticator_selection=AuthenticatorSelectionCriteria(
                    authenticator_attachment=None,  # Allow both
                    user_verification=UserVerificationRequirement.PREFERRED,
                    require_resident_key=False,  # Not required for Phase 1
                ),
                # Exclude existing credentials for this user
                exclude_credentials=[
                    PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred.credential_id))
                    for cred in user.passkey_credentials.all()
                ],
            )

            # Store challenge in session (or use a cache/DB for stateless)
            # For now, we'll return it and verify it matches in the complete step
            # In production, store in Redis with short TTL
            challenge = bytes_to_base64url(registration_options.challenge)

            # Convert to JSON-serializable format
            options_dict = json.loads(options_to_json(registration_options))

            logger.info(
                f"Passkey registration started for user {user.id}, device: {device_name}"
            )

            return Response(
                {
                    "challenge": challenge,
                    "options": options_dict,
                    "rp_id": rp_id,
                    "rp_origin": rp_origin,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.exception("Error generating passkey registration options")
            return Response(
                {"error": "Failed to generate registration options", "detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PasskeyRegisterCompleteView(APIView):
    """
    Complete passkey registration (WebAuthn create response).
    Verifies the credential and stores it.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        try:
            credential_json = request.data.get("credential")
            challenge = request.data.get("challenge")
            device_name = request.data.get("device_name", "")
            device_info = request.data.get("device_info", {})

            if not credential_json or not challenge:
                return Response(
                    {"error": "Missing credential or challenge"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Verify the registration response (credential can be dict, str, or RegistrationCredential)
            rp_id = get_rp_id(request)
            rp_origin = get_rp_origin(request)

            verification = verify_registration_response(
                credential=credential_json,  # Can be dict, str, or RegistrationCredential
                expected_challenge=base64url_to_bytes(challenge),
                expected_rp_id=rp_id,
                expected_origin=rp_origin,
            )

            # Store the credential
            credential_id_b64 = bytes_to_base64url(verification.credential_id)
            public_key_b64 = bytes_to_base64url(verification.credential_public_key)

            passkey_credential = PasskeyCredential.objects.create(
                user=user,
                credential_id=credential_id_b64,
                public_key=public_key_b64,
                sign_count=verification.sign_count,
                device_name=device_name or f"{device_info.get('platform', 'Unknown')} Device",
                device_info=device_info,
                last_used_at=timezone.now(),
            )

            # Update user's has_passkey flag
            user.has_passkey = True
            user.save(update_fields=["has_passkey"])

            logger.info(
                f"Passkey registered successfully for user {user.id}, credential: {credential_id_b64[:20]}..."
            )

            return Response(
                {
                    "success": True,
                    "credential_id": str(passkey_credential.id),
                    "device_name": passkey_credential.device_name,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.exception("Error completing passkey registration")
            return Response(
                {"error": "Failed to register passkey", "detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class PasskeyAuthenticateBeginView(APIView):
    """
    Begin passkey authentication (WebAuthn get).
    Returns challenge and options for the client to authenticate.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        # Get user identifier (email or username)
        user_identifier = request.data.get("email") or request.data.get("username")

        if not user_identifier:
            return Response(
                {"error": "Email or username required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Find user by email or username
            try:
                user = User.objects.get(
                    Q(email=user_identifier) | Q(username=user_identifier)
                )
            except User.DoesNotExist:
                # Don't reveal if user exists - return generic error
                return Response(
                    {"error": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            if not user.has_passkey:
                return Response(
                    {"error": "User does not have a passkey registered"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Get user's passkey credentials
            credentials = user.passkey_credentials.all()
            if not credentials.exists():
                return Response(
                    {"error": "No passkey credentials found"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Generate authentication options
            rp_id = get_rp_id(request)
            rp_origin = get_rp_origin(request)

            authentication_options = generate_authentication_options(
                rp_id=rp_id,
                allow_credentials=[
                    PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred.credential_id))
                    for cred in credentials
                ],
                user_verification=UserVerificationRequirement.PREFERRED,
            )

            challenge = bytes_to_base64url(authentication_options.challenge)
            options_dict = json.loads(options_to_json(authentication_options))

            logger.info(f"Passkey authentication started for user {user.id}")

            return Response(
                {
                    "challenge": challenge,
                    "options": options_dict,
                    "rp_id": rp_id,
                    "rp_origin": rp_origin,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.exception("Error generating passkey authentication options")
            return Response(
                {"error": "Failed to generate authentication options", "detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PasskeyAuthenticateCompleteView(APIView):
    """
    Complete passkey authentication (WebAuthn get response).
    Verifies the credential and returns JWT tokens.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        try:
            credential_json = request.data.get("credential")
            challenge = request.data.get("challenge")
            user_identifier = request.data.get("email") or request.data.get("username")

            if not credential_json or not challenge or not user_identifier:
                return Response(
                    {"error": "Missing required fields"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find user by email or username
            try:
                user = User.objects.get(
                    Q(email=user_identifier) | Q(username=user_identifier)
                )
            except User.DoesNotExist:
                return Response(
                    {"error": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Extract credential ID from the credential JSON
            credential_id_b64 = credential_json.get("id") or credential_json.get("rawId")
            if not credential_id_b64:
                return Response(
                    {"error": "Missing credential ID"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find the stored credential
            passkey_credential = PasskeyCredential.objects.filter(
                user=user, credential_id=credential_id_b64
            ).first()

            if not passkey_credential:
                return Response(
                    {"error": "Invalid credential"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Verify the authentication response
            rp_id = get_rp_id(request)
            rp_origin = get_rp_origin(request)

            verification = verify_authentication_response(
                credential=credential_json,  # Can be dict, str, or AuthenticationCredential
                expected_challenge=base64url_to_bytes(challenge),
                expected_rp_id=rp_id,
                expected_origin=rp_origin,
                credential_public_key=base64url_to_bytes(passkey_credential.public_key),
                credential_current_sign_count=passkey_credential.sign_count,
            )

            # Update credential sign count and last used
            passkey_credential.sign_count = verification.new_sign_count
            passkey_credential.last_used_at = timezone.now()
            passkey_credential.save(update_fields=["sign_count", "last_used_at"])

            # Generate JWT tokens
            refresh_token = RefreshToken.for_user(user)
            access_token = refresh_token.access_token

            logger.info(f"Passkey authentication successful for user {user.id}")

            return Response(
                {
                    "success": True,
                    "access_token": str(access_token),
                    "refresh_token": str(refresh_token),
                    "user_id": str(user.id),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.exception("Error completing passkey authentication")
            return Response(
                {"error": "Authentication failed", "detail": str(e)},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class PasskeyStatusView(APIView):
    """Get passkey status for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        credentials = user.passkey_credentials.all()

        return Response(
            {
                "has_passkey": user.has_passkey,
                "credentials": [
                    {
                        "id": str(cred.id),
                        "device_name": cred.device_name,
                        "created_at": cred.created_at.isoformat(),
                        "last_used_at": cred.last_used_at.isoformat() if cred.last_used_at else None,
                    }
                    for cred in credentials
                ],
            },
            status=status.HTTP_200_OK,
        )


class PasskeyRemoveView(APIView):
    """Remove a passkey credential."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, credential_id):
        user = request.user

        try:
            credential = PasskeyCredential.objects.get(id=credential_id, user=user)
            credential.delete()

            # Update has_passkey flag if no credentials remain
            if not user.passkey_credentials.exists():
                user.has_passkey = False
                user.save(update_fields=["has_passkey"])

            logger.info(f"Passkey removed for user {user.id}, credential: {credential_id}")

            return Response(
                {"success": True, "message": "Passkey removed successfully"},
                status=status.HTTP_200_OK,
            )

        except PasskeyCredential.DoesNotExist:
            return Response(
                {"error": "Credential not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.exception("Error removing passkey")
            return Response(
                {"error": "Failed to remove passkey", "detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

