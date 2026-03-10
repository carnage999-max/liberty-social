from django.db import migrations, models
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0017_add_user_slug"),
    ]

    operations = [
        migrations.CreateModel(
            name="SocialAccount",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                        verbose_name="Social Account ID",
                    ),
                ),
                ("provider", models.CharField(choices=[("google", "Google")], max_length=32)),
                ("provider_user_id", models.CharField(db_index=True, max_length=255)),
                ("email", models.EmailField(blank=True, max_length=254, null=True)),
                ("display_name", models.CharField(blank=True, max_length=255, null=True)),
                ("avatar_url", models.URLField(blank=True, null=True)),
                ("extra_data", models.JSONField(blank=True, default=dict)),
                ("linked_at", models.DateTimeField(auto_now_add=True)),
                ("last_login_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="social_accounts",
                        to="users.user",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["user", "provider"], name="users_socia_user_id_5b600a_idx"),
                    models.Index(
                        fields=["provider", "provider_user_id"],
                        name="users_socia_provide_04814b_idx",
                    ),
                ],
                "unique_together": {("provider", "provider_user_id"), ("user", "provider")},
            },
        ),
        migrations.AlterField(
            model_name="sessionhistory",
            name="authentication_method",
            field=models.CharField(
                choices=[("password", "Password"), ("passkey", "Passkey"), ("google", "Google")],
                default="password",
                help_text="Method used to authenticate",
                max_length=50,
                verbose_name="Authentication Method",
            ),
        ),
        migrations.AlterField(
            model_name="securityevent",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("login", "Login"),
                    ("login_failed", "Login Failed"),
                    ("logout", "Logout"),
                    ("social_account_linked", "Social Account Linked"),
                    ("social_account_unlinked", "Social Account Unlinked"),
                    ("passkey_registered", "Passkey Registered"),
                    ("passkey_removed", "Passkey Removed"),
                    ("device_removed", "Device Removed"),
                    ("session_revoked", "Session Revoked"),
                    ("account_locked", "Account Locked"),
                    ("account_unlocked", "Account Unlocked"),
                    ("password_changed", "Password Changed"),
                ],
                help_text="Type of security event",
                max_length=50,
                verbose_name="Event Type",
            ),
        ),
    ]
