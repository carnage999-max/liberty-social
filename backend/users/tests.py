from django.test import TestCase
from rest_framework.test import APIClient

from users.models import Session, User, UserSettings


class LoginCaseSensitivityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.password = "Securepassword123!"
        self.user = User.objects.create_user(
            email="alice@example.com",
            password=self.password,
            username="alice",
        )
        UserSettings.objects.create(user=self.user)

    def test_login_is_case_insensitive_for_email(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "Alice@Example.com", "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.data)

    def test_same_device_login_reuses_active_session(self):
        user_agent = (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
        )

        for _ in range(2):
            response = self.client.post(
                "/api/auth/login/",
                {"username": "alice@example.com", "password": self.password},
                format="json",
                HTTP_USER_AGENT=user_agent,
            )
            self.assertEqual(response.status_code, 200)

        sessions = Session.objects.filter(user=self.user, revoked_at__isnull=True)
        self.assertEqual(sessions.count(), 1)
        self.assertEqual(sessions.first().device_name, "Chrome on macOS")
