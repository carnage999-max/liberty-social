from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("main", "0011_add_message_edited_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="Page",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("business", "business"),
                            ("community", "community"),
                            ("brand", "brand"),
                            ("other", "other"),
                        ],
                        default="other",
                        max_length=50,
                    ),
                ),
                ("website_url", models.URLField(blank=True, null=True)),
                ("phone", models.CharField(blank=True, max_length=50, null=True)),
                ("email", models.EmailField(blank=True, max_length=254, null=True)),
                ("profile_image_url", models.URLField(blank=True, null=True)),
                ("cover_image_url", models.URLField(blank=True, null=True)),
                ("is_verified", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pages_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="post",
            name="author_type",
            field=models.CharField(
                choices=[("user", "user"), ("page", "page")], default="user", max_length=10
            ),
        ),
        migrations.CreateModel(
            name="PageAdmin",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("owner", "owner"),
                            ("admin", "admin"),
                            ("editor", "editor"),
                            ("moderator", "moderator"),
                        ],
                        default="admin",
                        max_length=20,
                    ),
                ),
                ("added_at", models.DateTimeField(auto_now_add=True)),
                (
                    "added_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="page_admins_added",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "page",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="admins",
                        to="main.page",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="page_admin_roles",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-added_at"],
                "unique_together": {("page", "user")},
            },
        ),
        migrations.CreateModel(
            name="PageFollower",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "page",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="followers",
                        to="main.page",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="followed_pages",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "unique_together": {("page", "user")},
            },
        ),
        migrations.CreateModel(
            name="PageAdminInvite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "pending"),
                            ("accepted", "accepted"),
                            ("declined", "declined"),
                            ("cancelled", "cancelled"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("admin", "admin"),
                            ("editor", "editor"),
                            ("moderator", "moderator"),
                        ],
                        default="admin",
                        max_length=20,
                    ),
                ),
                ("invited_at", models.DateTimeField(auto_now_add=True)),
                ("responded_at", models.DateTimeField(blank=True, null=True)),
                (
                    "invitee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="page_admin_invites",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "inviter",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="page_admin_invites_sent",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "page",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="admin_invites",
                        to="main.page",
                    ),
                ),
            ],
            options={
                "ordering": ["-invited_at"],
            },
        ),
        migrations.AddField(
            model_name="post",
            name="page",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="posts",
                to="main.page",
            ),
        ),
        migrations.AddConstraint(
            model_name="pageadmininvite",
            constraint=models.UniqueConstraint(
                condition=models.Q(("status", "pending")),
                fields=("page", "invitee"),
                name="unique_pending_invite_per_user",
            ),
        ),
    ]
