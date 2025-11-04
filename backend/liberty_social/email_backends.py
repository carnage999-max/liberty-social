import requests
import os
from decouple import config
from django.core.mail.backends.base import BaseEmailBackend


class ResendEmailBackend(BaseEmailBackend):
    """Simple Django email backend that sends messages through the Resend API.

    It expects RESEND_API_KEY to be present in environment variables.
    This backend is intentionally minimal: it posts a single email per Django EmailMessage
    and returns True on success. It does not implement batching or advanced features.
    """

    API_URL = "https://api.resend.com/emails"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.api_key = config('RESEND_API_KEY')

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        sent = 0
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
        }

        for message in email_messages:
            # Build recipients list
            tos = list(message.to or [])
            if not tos:
                continue

            payload = {
                'from': 'Liberty Social <no-reply@onresend.com>',
                'to': tos,
                'subject': message.subject or '',
                # Resend accepts html; if message.content_subtype == 'html' prefer that
                'html': message.body if message.content_subtype == 'html' else f"<pre>{message.body}</pre>",
            }

            try:
                resp = requests.post(self.API_URL, json=payload, headers=headers, timeout=10)
                resp.raise_for_status()
                sent += 1
            except Exception:
                # Do not raise; adhere to Django backend contract (silent failure optional)
                if not self.fail_silently:
                    raise

        return sent
