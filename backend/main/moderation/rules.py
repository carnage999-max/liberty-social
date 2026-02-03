import re
from dataclasses import dataclass
from typing import List, Pattern


@dataclass(frozen=True)
class ModerationRule:
    key: str
    label: str
    layer: str
    patterns: List[Pattern[str]]


def _compile(patterns: List[str]) -> List[Pattern[str]]:
    return [re.compile(p, re.IGNORECASE) for p in patterns]

PROFANITY_PATTERNS: List[str] = [
    r"\bfuck(?:ing|er|ers|ed)?\b",
    r"\bshit(?:ty|ting|ted|head)?\b",
    r"\basshole\b",
    r"\bbitch(?:es|ing)?\b",
    r"\bdamn\b",
    r"\bcrap\b",
    r"\bpiss(?:ed|ing)?\b",
    r"\bwtf\b",
]


L1_RULES: List[ModerationRule] = [
    ModerationRule(
        key="csam",
        label="CSAM",
        layer="L1",
        patterns=_compile(
            [
                r"\bchild\s+sexual\b",
                r"\bchild\s+porn\b",
                r"\bcsam\b",
            ]
        ),
    ),
    ModerationRule(
        key="violent_threat",
        label="Explicit threat",
        layer="L1",
        patterns=_compile(
            [
                r"\bkill\s+you\b",
                r"\bshoot\s+you\b",
                r"\bmurder\s+you\b",
            ]
        ),
    ),
    ModerationRule(
        key="terrorism_instructions",
        label="Terrorism instructions",
        layer="L1",
        patterns=_compile(
            [
                r"\bbuild\s+(a\s+)?bomb\b",
                r"\bhow\s+to\s+make\s+an?\s+explosive\b",
            ]
        ),
    ),
    ModerationRule(
        key="human_trafficking",
        label="Human trafficking facilitation",
        layer="L1",
        patterns=_compile(
            [
                r"\btraffic\s+(a|the)\s+girl\b",
                r"\btrafficking\s+route\b",
            ]
        ),
    ),
]

L2_RULES: List[ModerationRule] = [
    ModerationRule(
        key="graphic_violence",
        label="Graphic violence",
        layer="L2",
        patterns=_compile([r"\bgore\b", r"\bgraphic\s+violence\b"]),
    ),
    ModerationRule(
        key="hate_nonviolent",
        label="Hate speech (non-violent)",
        layer="L2",
        patterns=_compile([r"\bhate\s+speech\b"]),
    ),
    ModerationRule(
        key="explicit_adult",
        label="Explicit adult content",
        layer="L2",
        patterns=_compile([r"\bexplicit\s+sex\b", r"\bporno?\b"]),
    ),
    ModerationRule(
        key="drug_discussion",
        label="Drug usage discussion",
        layer="L2",
        patterns=_compile([r"\bhow\s+to\s+use\s+drugs\b", r"\bdrug\s+use\b"]),
    ),
    ModerationRule(
        key="political_extremism",
        label="Political extremism rhetoric",
        layer="L2",
        patterns=_compile([r"\bextremist\b", r"\bradical\s+ideology\b"]),
    ),
    ModerationRule(
        key="profanity",
        label="Profanity",
        layer="L2",
        patterns=_compile(PROFANITY_PATTERNS),
    ),
]
