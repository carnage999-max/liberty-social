from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("main", "0028_add_blur_explicit_toggle"),
    ]

    operations = [
        migrations.AddField(
            model_name="userfilterprofile",
            name="redact_profanity",
            field=models.BooleanField(default=False),
        ),
    ]
