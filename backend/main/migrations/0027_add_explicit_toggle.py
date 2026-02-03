from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("main", "0026_add_moderation_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="userfilterprofile",
            name="allow_explicit_content",
            field=models.BooleanField(default=False),
        ),
    ]
