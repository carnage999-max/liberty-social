from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("main", "0027_add_explicit_toggle"),
    ]

    operations = [
        migrations.AddField(
            model_name="userfilterprofile",
            name="blur_explicit_thumbnails",
            field=models.BooleanField(default=False),
        ),
    ]
