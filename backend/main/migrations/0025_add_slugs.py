from django.db import migrations, models
from django.utils.text import slugify


def _normalize_post_title(content: str, max_length: int = 80) -> str:
    if not content:
        return ""
    for line in content.splitlines():
        cleaned = line.strip()
        if cleaned:
            return cleaned[:max_length]
    return content.strip()[:max_length]


def _unique_slugify(model_cls, base: str, max_length: int = 255) -> str:
    base_slug = slugify(base or "") or "item"
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


def populate_slugs(apps, schema_editor):
    Post = apps.get_model("main", "Post")
    Page = apps.get_model("main", "Page")
    MarketplaceListing = apps.get_model("main", "MarketplaceListing")
    AnimalListing = apps.get_model("main", "AnimalListing")
    BreederDirectory = apps.get_model("main", "BreederDirectory")

    for post in Post.objects.all().iterator():
        if post.slug:
            continue
        source = _normalize_post_title(post.content)
        post.slug = _unique_slugify(Post, source or "post")
        post.save(update_fields=["slug"])

    for page in Page.objects.all().iterator():
        if page.slug:
            continue
        page.slug = _unique_slugify(Page, page.name or "page")
        page.save(update_fields=["slug"])

    for listing in MarketplaceListing.objects.all().iterator():
        if listing.slug:
            continue
        listing.slug = _unique_slugify(MarketplaceListing, listing.title or "listing")
        listing.save(update_fields=["slug"])

    for listing in AnimalListing.objects.all().iterator():
        if listing.slug:
            continue
        listing.slug = _unique_slugify(AnimalListing, listing.title or "listing")
        listing.save(update_fields=["slug"])

    for breeder in BreederDirectory.objects.all().iterator():
        if breeder.slug:
            continue
        breeder.slug = _unique_slugify(BreederDirectory, breeder.breeder_name or "breeder")
        breeder.save(update_fields=["slug"])


class Migration(migrations.Migration):
    dependencies = [
        ("main", "0024_add_stripe_payment_intent"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="slug",
            field=models.SlugField(blank=True, null=True, unique=True, max_length=255),
        ),
        migrations.AddField(
            model_name="page",
            name="slug",
            field=models.SlugField(blank=True, null=True, unique=True, max_length=255),
        ),
        migrations.AddField(
            model_name="marketplacelisting",
            name="slug",
            field=models.SlugField(blank=True, null=True, unique=True, max_length=255),
        ),
        migrations.AddField(
            model_name="animallisting",
            name="slug",
            field=models.SlugField(blank=True, null=True, unique=True, max_length=255),
        ),
        migrations.AddField(
            model_name="breederdirectory",
            name="slug",
            field=models.SlugField(blank=True, null=True, unique=True, max_length=255),
        ),
        migrations.RunPython(populate_slugs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="post",
            name="slug",
            field=models.SlugField(blank=True, unique=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="page",
            name="slug",
            field=models.SlugField(blank=True, unique=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="marketplacelisting",
            name="slug",
            field=models.SlugField(blank=True, unique=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="animallisting",
            name="slug",
            field=models.SlugField(blank=True, unique=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="breederdirectory",
            name="slug",
            field=models.SlugField(blank=True, unique=True, max_length=255),
        ),
    ]
