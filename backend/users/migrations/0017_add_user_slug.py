from django.db import migrations, models
from django.utils.text import slugify


def _unique_slugify(model_cls, base: str, max_length: int = 255) -> str:
    base_slug = slugify(base or "") or "user"
    candidate = base_slug[:max_length]
    if not model_cls.objects.filter(slug=candidate).exists():
        return candidate
    suffix = 2
    while True:
        suffix_str = f"-{suffix}"
        trimmed = base_slug[: max_length - len(suffix_str)]
        candidate = f"{trimmed}{suffix_str}"
        if not model_cls.objects.filter(slug=candidate).exists():
            return candidate
        suffix += 1


def populate_user_slugs(apps, schema_editor):
    User = apps.get_model("users", "User")
    for user in User.objects.all().iterator():
        if user.slug:
            continue
        base = user.username or user.email or "user"
        user.slug = _unique_slugify(User, base)
        user.save(update_fields=["slug"])


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0016_add_demographic_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="slug",
            field=models.SlugField(blank=True, null=True, unique=True, max_length=255),
        ),
        migrations.RunPython(populate_user_slugs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="slug",
            field=models.SlugField(blank=True, unique=True, max_length=255),
        ),
    ]
