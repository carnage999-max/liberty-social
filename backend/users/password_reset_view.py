from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from urllib.parse import urljoin, urlparse
from .models import User
from .emails import send_password_reset_email


class PasswordResetView(APIView):
    """Simple password reset view — sends an email with a tokenized reset link."""

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response(
                {"detail": "Email required"}, status=status.HTTP_400_BAD_REQUEST
            )
        user = User.objects.filter(email=email).first()
        if not user:
            # don't reveal whether email exists
            return Response(
                {"detail": "If the email exists, a reset link will be sent."}
            )

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

        # Build reset link using the frontend URL
        reset_path = f"password-reset-confirm/{uid}/{token}/"
        reset_url = urljoin(frontend_url, reset_path)

        try:
            send_password_reset_email(user, reset_url)
        except Exception:
            # don't surface email errors to client
            pass

        return Response({"detail": "If the email exists, a reset link will be sent."})
