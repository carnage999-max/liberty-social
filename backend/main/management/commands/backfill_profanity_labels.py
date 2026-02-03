"""
Backfill profanity classifications for existing posts.

Usage:
  python manage.py backfill_profanity_labels
  python manage.py backfill_profanity_labels --limit 500
  python manage.py backfill_profanity_labels --dry-run
"""

from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType

from main.models import Comment, Message, Post
from main.moderation_models import ContentClassification
from main.moderation.pipeline import _decision_from_text, record_text_classification


class Command(BaseCommand):
    help = "Backfill profanity labels for existing posts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Optional limit on number of posts to scan.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Scan and report matches without writing classifications.",
        )

    def handle(self, *args, **options):
        limit = options.get("limit")
        dry_run = options.get("dry_run")

        def backfill_for_model(model, label: str):
            ct = ContentType.objects.get_for_model(model)
            existing = set(
                ContentClassification.objects.filter(
                    content_type=ct, labels__contains=["Profanity"]
                ).values_list("object_id", flat=True)
            )
            qs = model.objects.order_by("id")
            if limit:
                qs = qs[:limit]

            scanned = 0
            matched = 0
            created = 0

            for obj in qs.iterator():
                scanned += 1
                if str(obj.id) in existing:
                    continue

                decision = _decision_from_text(getattr(obj, "content", "") or "")
                if "Profanity" not in decision.labels:
                    continue

                matched += 1
                if dry_run:
                    continue

                record_text_classification(
                    content_object=obj,
                    actor=None,
                    decision=decision,
                    model_version="rules-v1-backfill",
                    metadata={"context": f"{label}_backfill"},
                )
                created += 1

            return scanned, matched, created

        totals = []
        totals.append(("posts",) + backfill_for_model(Post, "post"))
        totals.append(("comments",) + backfill_for_model(Comment, "comment"))
        totals.append(("messages",) + backfill_for_model(Message, "message"))

        for label, scanned, matched, created in totals:
            self.stdout.write(
                self.style.SUCCESS(
                    f"{label}: Scanned {scanned}. Matches: {matched}. Created: {created}."
                )
            )
