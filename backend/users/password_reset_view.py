from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import User


class PasswordResetView(APIView):
    """Simple password reset view — sends an email with a tokenized reset link."""

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'detail': 'Email required'}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(email=email).first()
        if not user:
            # don't reveal whether email exists
            return Response({'detail': 'If the email exists, a reset link will be sent.'})

        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        # Build a simple reset link — frontend should handle token+uid to set new password
        reset_path = f"/password-reset-confirm/{uid}/{token}/"
        reset_url = request.build_absolute_uri(reset_path)

        subject = 'Password reset for your account'
        message = f'Use the link to reset your password: {reset_url}'
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None)
        try:
            send_mail(subject, message, from_email, [user.email], fail_silently=False)
        except Exception:
            # don't surface email errors to client
            pass

        return Response({'detail': 'If the email exists, a reset link will be sent.'})
