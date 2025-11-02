from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0006_alter_reaction_content_type"),
    ]

    operations = [
        migrations.CreateModel(
            name="CommentMedia",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("url", models.URLField()),
                ("content_type", models.CharField(blank=True, max_length=50, null=True)),
                ("comment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="media", to="main.comment")),
            ],
        ),
    ]
