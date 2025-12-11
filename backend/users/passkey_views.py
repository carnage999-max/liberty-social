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

from .models import User, PasskeyCredential, Session, SessionHistory, SecurityEvent
from .device_utils import get_client_ip, get_user_agent, get_location_from_ip, extract_device_info

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

            # Ensure user.email exists (required field, but double-check)
            if not user.email:
                return Response(
                    {"error": "User email is required for passkey registration"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Exclude existing credentials for this user
            exclude_credentials = []
            for cred in user.passkey_credentials.all():
                if cred.credential_id:
                    try:
                        exclude_credentials.append(
                            PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred.credential_id))
                        )
                    except Exception as e:
                        logger.warning(f"Failed to decode credential_id for exclusion: {e}")
                        continue

            registration_options = generate_registration_options(
                rp_id=rp_id,
                rp_name="Liberty Social",
                user_id=bytes(str(user.id), "utf-8"),
                user_name=user.email,
                user_display_name=user.get_full_name() or user.username or user.email or "User",
                # Allow both platform and cross-platform authenticators
                authenticator_selection=AuthenticatorSelectionCriteria(
                    authenticator_attachment=None,  # Allow both
                    user_verification=UserVerificationRequirement.PREFERRED,
                    require_resident_key=False,  # Not required for Phase 1
                ),
                exclude_credentials=exclude_credentials,
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

            # Validate challenge is not empty
            if not isinstance(challenge, str) or not challenge.strip():
                return Response(
                    {"error": "Invalid challenge"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Ensure credential_json is a dict (can be dict, str, or RegistrationCredential)
            if not isinstance(credential_json, dict):
                return Response(
                    {"error": "Invalid credential format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Ensure device_info is a dict
            if not isinstance(device_info, dict):
                device_info = {}

            # Verify the registration response (credential can be dict, str, or RegistrationCredential)
            rp_id = get_rp_id(request)
            rp_origin = get_rp_origin(request)

            try:
                challenge_bytes = base64url_to_bytes(challenge)
            except Exception as e:
                logger.error(f"Failed to decode challenge: {e}")
                return Response(
                    {"error": "Invalid challenge format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            verification = verify_registration_response(
                credential=credential_json,  # Can be dict, str, or RegistrationCredential
                expected_challenge=challenge_bytes,
                expected_rp_id=rp_id,
                expected_origin=rp_origin,
            )

            # Store the credential
            credential_id_b64 = bytes_to_base64url(verification.credential_id)
            public_key_b64 = bytes_to_base64url(verification.credential_public_key)

            # Get device info from request
            ip_address = get_client_ip(request)
            user_agent = get_user_agent(request)
            location = get_location_from_ip(ip_address)
            
            # Enhance device_info with extracted info
            if user_agent:
                extracted_info = extract_device_info(user_agent)
                device_info.update(extracted_info)

            passkey_credential = PasskeyCredential.objects.create(
                user=user,
                credential_id=credential_id_b64,
                public_key=public_key_b64,
                sign_count=verification.sign_count,
                device_name=device_name or f"{device_info.get('platform', 'Unknown')} Device",
                device_info=device_info,
                ip_address=ip_address,
                location=location,
                last_seen_ip=ip_address,
                last_seen_location=location,
                last_used_at=timezone.now(),
            )

            # Update user's has_passkey flag
            user.has_passkey = True
            user.save(update_fields=["has_passkey"])

            # Log security event
            SecurityEvent.objects.create(
                user=user,
                event_type="passkey_registered",
                description=f"Passkey registered on {passkey_credential.device_name}",
                ip_address=ip_address,
                user_agent=user_agent,
                metadata={"device_id": str(passkey_credential.id), "device_name": passkey_credential.device_name},
            )

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
        # Get user identifier (email or username) - optional for better UX
        # If not provided, we'll allow all credentials (browser will show available passkeys)
        user_identifier = request.data.get("email") or request.data.get("username")

        try:
            if user_identifier:
                # If user identifier provided, only allow that user's credentials
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
                
                allow_credentials = []
                for cred in credentials:
                    if cred.credential_id:
                        try:
                            allow_credentials.append(
                                PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred.credential_id))
                            )
                        except Exception as e:
                            logger.warning(f"Failed to decode credential_id: {e}")
                            continue
            else:
                # No user identifier - allow all credentials (browser will show available passkeys)
                # This is less secure but provides better UX
                all_credentials = PasskeyCredential.objects.all()
                if not all_credentials.exists():
                    return Response(
                        {"error": "No passkey credentials found"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                
                allow_credentials = []
                for cred in all_credentials:
                    if cred.credential_id:
                        try:
                            allow_credentials.append(
                                PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred.credential_id))
                            )
                        except Exception as e:
                            logger.warning(f"Failed to decode credential_id: {e}")
                            continue

            # Generate authentication options
            rp_id = get_rp_id(request)
            rp_origin = get_rp_origin(request)

            authentication_options = generate_authentication_options(
                rp_id=rp_id,
                allow_credentials=allow_credentials,
                user_verification=UserVerificationRequirement.PREFERRED,
            )

            challenge = bytes_to_base64url(authentication_options.challenge)
            options_dict = json.loads(options_to_json(authentication_options))

            if user_identifier:
                logger.info(f"Passkey authentication started for user {user.id}")
            else:
                logger.info("Passkey authentication started (no user identifier provided)")

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

            if not credential_json or not challenge:
                return Response(
                    {"error": "Missing required fields"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate challenge is not empty
            if not isinstance(challenge, str) or not challenge.strip():
                return Response(
                    {"error": "Invalid challenge"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Ensure credential_json is a dict
            if not isinstance(credential_json, dict):
                return Response(
                    {"error": "Invalid credential format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Extract credential ID from the credential JSON
            credential_id_b64 = credential_json.get("id") or credential_json.get("rawId")
            if not credential_id_b64:
                return Response(
                    {"error": "Missing credential ID"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find the stored credential by credential_id (this identifies the user)
            passkey_credential = PasskeyCredential.objects.filter(
                credential_id=credential_id_b64
            ).first()

            if not passkey_credential:
                return Response(
                    {"error": "Invalid credential"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Get user from the credential
            user = passkey_credential.user

            # If user_identifier was provided, validate it matches (optional security check)
            if user_identifier:
                user_email = user.email or ""
                user_username = user.username or ""
                if user_email != user_identifier and user_username != user_identifier:
                    return Response(
                        {"error": "Invalid credentials"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

            # Verify the authentication response
            rp_id = get_rp_id(request)
            rp_origin = get_rp_origin(request)

            try:
                challenge_bytes = base64url_to_bytes(challenge)
                public_key_bytes = base64url_to_bytes(passkey_credential.public_key)
            except Exception as e:
                logger.error(f"Failed to decode challenge or public key: {e}")
                return Response(
                    {"error": "Invalid credential data format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            verification = verify_authentication_response(
                credential=credential_json,  # Can be dict, str, or AuthenticationCredential
                expected_challenge=challenge_bytes,
                expected_rp_id=rp_id,
                expected_origin=rp_origin,
                credential_public_key=public_key_bytes,
                credential_current_sign_count=passkey_credential.sign_count,
            )

            # Update credential sign count and last used
            passkey_credential.sign_count = verification.new_sign_count
            passkey_credential.last_used_at = timezone.now()
            
            # Update last seen info
            ip_address = get_client_ip(request)
            user_agent = get_user_agent(request)
            location = get_location_from_ip(ip_address)
            
            passkey_credential.last_seen_ip = ip_address
            passkey_credential.last_seen_location = location
            passkey_credential.save(update_fields=["sign_count", "last_used_at", "last_seen_ip", "last_seen_location"])

            # Generate JWT tokens
            refresh_token = RefreshToken.for_user(user)
            access_token = refresh_token.access_token

            # Extract token JTIs for session tracking
            from rest_framework_simplejwt.tokens import UntypedToken
            from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
            token_jti = None
            refresh_token_jti = None
            try:
                untyped_token = UntypedToken(str(access_token))
                token_jti = untyped_token.get("jti")
            except (InvalidToken, TokenError, KeyError):
                pass  # If we can't get jti, continue without it
            
            try:
                untyped_refresh_token = UntypedToken(str(refresh_token))
                refresh_token_jti = untyped_refresh_token.get("jti")
            except (InvalidToken, TokenError, KeyError):
                pass  # If we can't get refresh token jti, continue without it

            # Create session
            session = Session.objects.create(
                user=user,
                device_id=passkey_credential.id,
                device_name=passkey_credential.device_name,
                ip_address=ip_address,
                location=location,
                user_agent=user_agent,
                token_jti=token_jti,
                refresh_token_jti=refresh_token_jti,
            )

            # Create session history entry
            SessionHistory.objects.create(
                user=user,
                device_id=passkey_credential.id,
                device_name=passkey_credential.device_name,
                ip_address=ip_address,
                location=location,
                user_agent=user_agent,
                authentication_method="passkey",
            )

            # Log security event
            SecurityEvent.objects.create(
                user=user,
                event_type="login",
                description=f"Login via passkey on {passkey_credential.device_name}",
                ip_address=ip_address,
                user_agent=user_agent,
                metadata={"device_id": str(passkey_credential.id), "session_id": str(session.id)},
            )

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

