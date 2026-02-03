from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from rest_framework.exceptions import ValidationError

from ..moderation_models import ComplianceLog, ContentClassification, ModerationAction
from .rules import L1_RULES, L2_RULES, ModerationRule


@dataclass(frozen=True)
class ModerationDecision:
    blocked: bool
    labels: List[str]
    matched_rules: List[Tuple[str, str]]
    reason_code: Optional[str] = None
    rule_ref: Optional[str] = None


def _match_rules(text: str, rules: List[ModerationRule]) -> List[ModerationRule]:
    matches: List[ModerationRule] = []
    if not text:
        return matches
    for rule in rules:
        if any(pattern.search(text) for pattern in rule.patterns):
            matches.append(rule)
    return matches


def _decision_from_text(text: str) -> ModerationDecision:
    l1_matches = _match_rules(text, L1_RULES)
    if l1_matches:
        match = l1_matches[0]
        return ModerationDecision(
            blocked=True,
            labels=[match.label],
            matched_rules=[(match.key, match.label)],
            reason_code=match.key,
            rule_ref=f"L1:{match.key}",
        )

    l2_matches = _match_rules(text, L2_RULES)
    labels = [match.label for match in l2_matches]
    matched = [(match.key, match.label) for match in l2_matches]
    return ModerationDecision(
        blocked=False,
        labels=labels,
        matched_rules=matched,
        reason_code=matched[0][0] if matched else None,
        rule_ref=f"L2:{matched[0][0]}" if matched else None,
    )


def precheck_text_or_raise(
    *,
    text: str,
    actor,
    context: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> ModerationDecision:
    decision = _decision_from_text(text)
    if decision.blocked:
        ComplianceLog.objects.create(
            layer="L1",
            category=decision.reason_code or "unknown",
            actor=actor,
            content_snippet=(text or "")[:500],
            metadata={"context": context, **(metadata or {})},
        )
        ModerationAction.objects.create(
            layer="L1",
            action="block",
            reason_code=decision.reason_code or "unknown",
            rule_ref=decision.rule_ref or "L1:unknown",
            actor=actor,
            metadata={"context": context, "matched_rules": decision.matched_rules},
        )
        raise ValidationError(
            {"detail": "Content violates hard prohibited content policy."}
        )

    return decision


def record_text_classification(
    *,
    content_object,
    actor,
    decision: ModerationDecision,
    model_version: str = "rules-v1",
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    content_type = ContentType.objects.get_for_model(content_object.__class__)
    labels = decision.labels
    matched_rules = decision.matched_rules

    with transaction.atomic():
        ContentClassification.objects.create(
            content_type=content_type,
            object_id=content_object.pk,
            model_version=model_version,
            labels=labels,
            confidences={label: 0.9 for label in labels},
            features={"matched_rules": matched_rules, **(metadata or {})},
            actor=actor,
        )

        if labels:
            ModerationAction.objects.create(
                content_type=content_type,
                object_id=content_object.pk,
                layer="L2",
                action="label",
                reason_code=decision.reason_code or "sensitive",
                rule_ref=decision.rule_ref or "L2:sensitive",
                actor=actor,
                metadata={"labels": labels, "matched_rules": matched_rules},
            )
