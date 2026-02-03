import re
from typing import Iterable, Pattern

from .rules import PROFANITY_PATTERNS


def _compile(patterns: Iterable[str]) -> list[Pattern[str]]:
    return [re.compile(p, re.IGNORECASE) for p in patterns]


_PROFANITY_REGEXES = _compile(PROFANITY_PATTERNS)


def redact_profanity(text: str) -> str:
    if not text:
        return text
    redacted = text
    for pattern in _PROFANITY_REGEXES:
        redacted = pattern.sub("****", redacted)
    return redacted
