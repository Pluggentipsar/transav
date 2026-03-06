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

    return AnonymizationResult(text=anonymized, entities_found=count)


# Pattern-based anonymization
PATTERNS: list[tuple[str, str]] = [
    # Personnummer: YYYYMMDD-XXXX
    (r"\b\d{8}[-–]\d{4}\b", "[PERSONNUMMER]"),
    # Telefonnummer
    (r"\b(?:0\d{1,3}[-–\s]?\d{2,3}[-–\s]?\d{2}[-–\s]?\d{2})\b", "[TELEFONNUMMER]"),
    (r"\b(?:07\d[-–\s]?\d{3}[-–\s]?\d{2}[-–\s]?\d{2})\b", "[TELEFONNUMMER]"),
    # E-post
    (r"\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b", "[E-POST]"),
    # Postnummer
    (r"\b\d{3}\s?\d{2}\b", "[POSTNUMMER]"),
    # Datum
    (r"\b\d{4}[-–/]\d{2}[-–/]\d{2}\b", "[DATUM]"),
    # URL
    (r"https?://[^\s]+", "[URL]"),
    # Registreringsnummer
    (r"\b[A-Z]{3}\s?\d{2}[A-Z0-9]\b", "[REGNUMMER]"),
]

# Svenska institutionsmonster
INSTITUTION_PATTERNS: list[tuple[str, str]] = [
    (r"\b(?:pa|i|vid|fran)\s+(?:\w+)?(?:skolan|gymnasiet|universitetet|hogskolan)\b",
     "[INSTITUTION]"),
    (r"\b(?:pa|i|vid|fran)\s+(?:\w+)?(?:sjukhuset|vardcentralen|kliniken)\b", "[INSTITUTION]"),
    (r"\b(?:pa|i|vid|fran)\s+(?:\w+)?(?:kommunen|regionen|lansstyrelsen)\b", "[INSTITUTION]"),
]


def anonymize_patterns(
    text: str,
    include_institutions: bool = True,
) -> AnonymizationResult:
    """Anonymize text using regex patterns."""
    anonymized = text
    count = 0

    all_patterns = PATTERNS.copy()
    if include_institutions:
        all_patterns.extend(INSTITUTION_PATTERNS)

    for pattern, replacement in all_patterns:
        matches = re.findall(pattern, anonymized, re.IGNORECASE)
        count += len(matches)
        anonymized = re.sub(pattern, replacement, anonymized, flags=re.IGNORECASE)

    return AnonymizationResult(text=anonymized, entities_found=count)
