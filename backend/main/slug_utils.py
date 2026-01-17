from django.http import Http404
from django.utils.text import slugify


def normalize_post_title(content: str, max_length: int = 80) -> str:
    if not content:
        return ""
    for line in content.splitlines():
        cleaned = line.strip()
        if cleaned:
            return cleaned[:max_length]
    return content.strip()[:max_length]


def unique_slugify(
    model_cls,
    base: str,
    *,
    slug_field: str = "slug",
    max_length: int = 255,
    fallback: str = "item",
) -> str:
    base_slug = slugify(base or "") or fallback
    candidate = base_slug[:max_length]
    if not model_cls.objects.filter(**{slug_field: candidate}).exists():
        return candidate
    suffix = 2
    while True:
        suffix_str = f"-{suffix}"
        trimmed = base_slug[: max_length - len(suffix_str)]
        candidate = f"{trimmed}{suffix_str}"
        if not model_cls.objects.filter(**{slug_field: candidate}).exists():
            return candidate
        suffix += 1


class SlugOrIdLookupMixin:
    slug_field = "slug"
    id_field = "id"

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs.get(lookup_url_kwarg)
        if lookup_value is None:
            raise Http404
        obj = queryset.filter(**{self.slug_field: lookup_value}).first()
        if obj is None:
            obj = queryset.filter(**{self.id_field: lookup_value}).first()
        if obj is None:
            raise Http404
        self.check_object_permissions(self.request, obj)
        return obj
