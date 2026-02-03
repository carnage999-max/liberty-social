from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("contenttypes", "0002_remove_content_type_name"),
        ("main", "0025_add_slugs"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ContentClassification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("object_id", models.CharField(max_length=64)),
                ("model_version", models.CharField(max_length=64)),
                ("labels", models.JSONField(default=list)),
                ("confidences", models.JSONField(default=dict)),
                ("features", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("content_type", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="contenttypes.contenttype")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["content_type", "object_id"], name="main_conte_content_c6f5b4_idx"),
                    models.Index(fields=["created_at"], name="main_conte_created_7b9155_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ModerationAction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("object_id", models.CharField(blank=True, max_length=64, null=True)),
                ("layer", models.CharField(max_length=8)),
                ("action", models.CharField(max_length=32)),
                ("reason_code", models.CharField(max_length=64)),
                ("rule_ref", models.CharField(max_length=64)),
                ("metadata", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("content_type", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="contenttypes.contenttype")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["content_type", "object_id"], name="main_moder_content_25ea13_idx"),
                    models.Index(fields=["layer", "action"], name="main_moder_layer_1d07d1_idx"),
                    models.Index(fields=["created_at"], name="main_moder_created_3bcba8_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ComplianceLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("layer", models.CharField(max_length=8)),
                ("category", models.CharField(max_length=64)),
                ("object_id", models.CharField(blank=True, max_length=64, null=True)),
                ("content_snippet", models.TextField(blank=True)),
                ("content_hash", models.CharField(blank=True, max_length=128)),
                ("metadata", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("action", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="main.moderationaction")),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("content_type", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="contenttypes.contenttype")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["layer", "category"], name="main_compl_layer_9a5f4d_idx"),
                    models.Index(fields=["created_at"], name="main_compl_created_2e63f4_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="UserFilterProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=64)),
                ("is_default", models.BooleanField(default=False)),
                ("category_toggles", models.JSONField(default=dict)),
                ("blur_thumbnails", models.BooleanField(default=False)),
                ("age_gate", models.BooleanField(default=False)),
                ("keyword_mutes", models.JSONField(default=list)),
                ("account_mutes", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="filter_profiles", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "unique_together": {("user", "name")},
            },
        ),
        migrations.CreateModel(
            name="UserFilterPreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("active_profile", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="main.userfilterprofile")),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="filter_preferences", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="Appeal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.TextField()),
                ("status", models.CharField(default="pending", max_length=32)),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("decided_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="moderation_appeals_decided", to=settings.AUTH_USER_MODEL)),
                ("moderation_action", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="appeals", to="main.moderationaction")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="moderation_appeals", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "indexes": [
                    models.Index(fields=["status", "created_at"], name="main_appea_status_4edb45_idx"),
                ],
            },
        ),
    ]
