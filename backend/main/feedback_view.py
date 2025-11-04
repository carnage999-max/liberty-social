from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import EmailMessage
from django.utils.html import format_html
from django.conf import settings
from .s3 import upload_fileobj_to_s3


class FeedbackView(APIView):
    """
    Accepts: message (string), screenshot (file, optional)
    Uploads screenshot to S3 and emails the report to ADMIN_EMAIL.
    """

    def post(self, request):
        message = request.data.get("message", "").strip()
        screenshot = request.FILES.get("screenshot")

        if not message:
            return Response(
                {"error": "Message is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        # Upload screenshot to S3 (if provided)
        screenshot_url = None
        if screenshot:
            try:
                screenshot_url = upload_fileobj_to_s3(
                    screenshot,
                    filename=screenshot.name,
                    content_type=screenshot.content_type,
                )
            except Exception as e:
                return Response(
                    {"error": f"Failed to upload screenshot: {e}"}, status=500
                )

        # Build HTML body
        html_body = format_html(
            """
            <h2>🐞 New Bug Report</h2>
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-line;">{}</p>
            {}
            <hr>
            <p><em>Reported from:</em> {}</p>
            """,
            message,
            (
                format_html(
                    '<p><a href="{}" target="_blank">View Screenshot</a></p>',
                    screenshot_url,
                )
                if screenshot_url
                else ""
            ),
            request.META.get("REMOTE_ADDR", "unknown IP"),
        )

        # Send email via Resend backend
        email = EmailMessage(
            subject="🐞 New Bug Report — Liberty Social",
            body=html_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[settings.ADMIN_EMAIL],
        )
        email.content_subtype = "html"
        email.send(fail_silently=False)

        return Response({"status": "sent"}, status=status.HTTP_200_OK)
