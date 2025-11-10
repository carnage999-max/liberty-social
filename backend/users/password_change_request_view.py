from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from urllib.parse import urljoin
from .emails import send_password_change_request_email


class RequestPasswordChangeView(APIView):
    """Request password change for authenticated users — sends an email with a tokenized change link."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Get frontend URL from request origin or settings
        frontend_url = settings.FRONTEND_URL
        if not frontend_url:
            origin = request.headers.get("origin")
            if origin:
                frontend_url = origin
            else:
                # Fallback to request host, assuming https
                frontend_url = f"https://{request.get_host()}"

        # Ensure the URL ends with a slash for urljoin to work correctly
        if not frontend_url.endswith("/"):
            frontend_url += "/"

        # Build change link using the frontend URL
        # Reuse the same password reset confirm endpoint since it uses the same token mechanism
        change_path = f"password-reset-confirm/{uid}/{token}/"
        change_url = urljoin(frontend_url, change_path)

        try:
            send_password_change_request_email(user, change_url)
        except Exception as e:
            # Log the error but don't reveal it to the user
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send password change email: {e}")
            return Response(
                {"detail": "Failed to send password change email. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {"detail": "Password change link has been sent to your email address."}
        )

