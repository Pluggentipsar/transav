"""Anonymization service: NER-based (KB-BERT) + pattern-based (regex)."""

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# NER model cache
_ner_pipeline: object | None = None


def is_ner_available() -> bool:
    """Check if NER dependencies are installed."""
    try:
        import transformers  # noqa: F401

        return True
    except ImportError:
        return False


@dataclass
class AnonymizationResult:
    text: str
    entities_found: int
    entity_counts: dict[str, int] | None = None


def anonymize_ner(
    text: str,
    entity_types: list[str] | None = None,
    confidence_threshold: float = 0.7,
) -> AnonymizationResult:
    """Anonymize text using KB-BERT NER.

    Entity types: PER/PRS (person), LOC (location), ORG (organization),
    TME (time/date), EVN (event).
    """
    global _ner_pipeline

    if not is_ner_available():
        return AnonymizationResult(text=text, entities_found=0)

    if _ner_pipeline is None:
        from transformers import pipeline

        _ner_pipeline = pipeline(
            "ner",
            model="KB/bert-base-swedish-cased-ner",
            aggregation_strategy="simple",
        )

    results = _ner_pipeline(text)  # type: ignore[operator]

    # Sort by position (reverse) to replace from end to start
    results.sort(key=lambda x: x["start"], reverse=True)  # type: ignore[index]

    default_types = {"PER", "PRS", "LOC", "ORG", "TME", "EVN"}
    allowed_types = set(entity_types) if entity_types else default_types
    anonymized = text
    count = 0
    counts: dict[str, int] = {}

    label_map = {
        "PER": "PERSON",
        "PRS": "PERSON",
        "LOC": "PLATS",
        "ORG": "ORGANISATION",
        "TME": "DATUM",
        "EVN": "HANDELSE",
    }

    for entity in results:  # type: ignore[union-attr]
        etype = entity["entity_group"]
        if etype not in allowed_types:
            continue
        if entity["score"] < confidence_threshold:
            continue

        label = label_map.get(etype, etype)
        anonymized = anonymized[: entity["start"]] + f"[{label}]" + anonymized[entity["end"] :]
        count += 1
        counts[label] = counts.get(label, 0) + 1

    return AnonymizationResult(text=anonymized, entities_found=count, entity_counts=counts)


# Pattern-based anonymization: (category, regex, replacement)
PATTERNS: list[tuple[str, str, str]] = [
    ("personnummer", r"\b\d{8}[-–]\d{4}\b", "[PERSONNUMMER]"),
    ("telefon", r"\b(?:0\d{1,3}[-–\s]?\d{2,3}[-–\s]?\d{2}[-–\s]?\d{2})\b", "[TELEFONNUMMER]"),
    ("telefon", r"\b(?:07\d[-–\s]?\d{3}[-–\s]?\d{2}[-–\s]?\d{2})\b", "[TELEFONNUMMER]"),
    ("epost", r"\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b", "[E-POST]"),
    ("postnummer", r"\b\d{3}\s?\d{2}\b", "[POSTNUMMER]"),
    ("datum", r"\b\d{4}[-–/]\d{2}[-–/]\d{2}\b", "[DATUM]"),
    ("url", r"https?://[^\s]+", "[URL]"),
    ("regnummer", r"\b[A-Z]{3}\s?\d{2}[A-Z0-9]\b", "[REGNUMMER]"),
    # Svenska institutionsmonster
    (
        "institutioner",
        r"\b(?:pa|i|vid|fran)\s+(?:\w+)?(?:skolan|gymnasiet|universitetet|hogskolan)\b",
        "[INSTITUTION]",
    ),
    (
        "institutioner",
        r"\b(?:pa|i|vid|fran)\s+(?:\w+)?(?:sjukhuset|vardcentralen|kliniken)\b",
        "[INSTITUTION]",
    ),
    (
        "institutioner",
        r"\b(?:pa|i|vid|fran)\s+(?:\w+)?(?:kommunen|regionen|lansstyrelsen)\b",
        "[INSTITUTION]",
    ),
]

ALL_PATTERN_CATEGORIES: list[str] = [
    "personnummer", "telefon", "epost", "postnummer", "datum", "url", "regnummer", "institutioner",
]


def anonymize_patterns(
    text: str,
    pattern_types: list[str] | None = None,
) -> AnonymizationResult:
    """Anonymize text using regex patterns.

    Args:
        text: Text to process.
        pattern_types: List of pattern category IDs to apply. None = all.
    """
    anonymized = text
    count = 0
    counts: dict[str, int] = {}

    for category, pattern, replacement in PATTERNS:
        if pattern_types is not None and category not in pattern_types:
            continue
        matches = re.findall(pattern, anonymized, re.IGNORECASE)
        if matches:
            label = replacement.strip("[]")
            count += len(matches)
            counts[label] = counts.get(label, 0) + len(matches)
        anonymized = re.sub(pattern, replacement, anonymized, flags=re.IGNORECASE)

    return AnonymizationResult(text=anonymized, entities_found=count, entity_counts=counts)


def anonymize_custom_words(
    text: str,
    replacements: list[tuple[str, str]],
) -> AnonymizationResult:
    """Replace custom words/phrases in text.

    Args:
        text: Text to process.
        replacements: List of (original, replacement) tuples.
            Case-insensitive whole-word matching.
    """
    anonymized = text
    count = 0
    counts: dict[str, int] = {}

    for original, replacement in replacements:
        if not original.strip():
            continue
        # Escape regex special chars, match whole word, case-insensitive
        pattern = r"\b" + re.escape(original.strip()) + r"\b"
        matches = re.findall(pattern, anonymized, re.IGNORECASE)
        if matches:
            label = replacement.strip("[]")
            count += len(matches)
            counts[label] = counts.get(label, 0) + len(matches)
        anonymized = re.sub(pattern, replacement, anonymized, flags=re.IGNORECASE)

    return AnonymizationResult(text=anonymized, entities_found=count, entity_counts=counts)
