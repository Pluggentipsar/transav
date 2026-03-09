"""Anonymization endpoints for standalone and job-based anonymization."""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.models.job import Job
from app.models.segment import Segment
from app.models.template import WordTemplate
from app.services.anonymization import (
    anonymize_custom_words,
    anonymize_ner,
    anonymize_patterns,
    is_ner_available,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Request/Response schemas ---


class WordReplacement(BaseModel):
    """A single custom word replacement."""

    original: str
    replacement: str


class AnonymizeTextRequest(BaseModel):
    """Request for standalone text anonymization."""

    text: str
    use_ner: bool = True
    use_patterns: bool = True
    entity_types: list[str] | None = None
    pattern_types: list[str] | None = None
    custom_words: list[WordReplacement] = []


class AnonymizeTextResponse(BaseModel):
    """Response from text anonymization."""

    original_text: str
    anonymized_text: str
    entities_found: int
    entity_counts: dict[str, int] = {}


class AnonymizeStatusResponse(BaseModel):
    """NER model availability status."""

    ner_available: bool
    ner_model: str
    patterns_available: bool
    pattern_count: int


class JobAnonymizationResponse(BaseModel):
    """Response from job anonymization."""

    job_id: str
    segments_processed: int
    total_entities_found: int
    message: str
    entity_counts: dict[str, int] = {}


class RunAnonymizationRequest(BaseModel):
    """Optional request body for run-anonymization."""

    entity_types: list[str] | None = None
    pattern_types: list[str] | None = None


class EnhanceAnonymizationRequest(BaseModel):
    """Optional request body for enhance-anonymization."""

    pattern_types: list[str] | None = None


# --- Endpoints ---


@router.post("/anonymize", response_model=AnonymizeTextResponse)
async def anonymize_text(data: AnonymizeTextRequest) -> AnonymizeTextResponse:
    """Standalone text anonymization."""
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Ingen text att anonymisera")

    anonymized = data.text
    total_entities = 0
    merged_counts: dict[str, int] = {}

    if data.use_ner:
        if not is_ner_available():
            logger.warning("NER requested but not available")
        else:
            ner_result = await asyncio.to_thread(
                anonymize_ner, data.text, entity_types=data.entity_types
            )
            anonymized = ner_result.text
            total_entities += ner_result.entities_found
            if ner_result.entity_counts:
                for k, v in ner_result.entity_counts.items():
                    merged_counts[k] = merged_counts.get(k, 0) + v

    if data.use_patterns:
        pattern_result = anonymize_patterns(anonymized, pattern_types=data.pattern_types)
        anonymized = pattern_result.text
        total_entities += pattern_result.entities_found
        if pattern_result.entity_counts:
            for k, v in pattern_result.entity_counts.items():
                merged_counts[k] = merged_counts.get(k, 0) + v

    if data.custom_words:
        replacements = [(w.original, w.replacement) for w in data.custom_words]
        custom_result = anonymize_custom_words(anonymized, replacements)
        anonymized = custom_result.text
        total_entities += custom_result.entities_found
        if custom_result.entity_counts:
            for k, v in custom_result.entity_counts.items():
                merged_counts[k] = merged_counts.get(k, 0) + v

    return AnonymizeTextResponse(
        original_text=data.text,
        anonymized_text=anonymized,
        entities_found=total_entities,
        entity_counts=merged_counts,
    )


@router.get("/anonymize/status", response_model=AnonymizeStatusResponse)
async def anonymize_status() -> AnonymizeStatusResponse:
    """Check if NER model and pattern engine are available."""
    from app.services.anonymization import PATTERNS

    return AnonymizeStatusResponse(
        ner_available=is_ner_available(),
        ner_model="KB/bert-base-swedish-cased-ner",
        patterns_available=True,
        pattern_count=len(PATTERNS),
    )


async def _load_template_replacements(
    session: AsyncSession,
    template_id: str | None,
) -> list[tuple[str, str]]:
    """Load word replacements from a template."""
    if not template_id:
        return []
    import json as json_mod

    result = await session.execute(
        select(WordTemplate).where(WordTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        return []
    try:
        words = json_mod.loads(template.words_json)
        return [(w["original"], w["replacement"]) for w in words]
    except (json_mod.JSONDecodeError, KeyError):
        logger.warning("Failed to parse template %s", template_id)
        return []


async def _get_completed_job_segments(
    session: AsyncSession,
    job_id: str,
) -> tuple["Job", list["Segment"]]:
    """Load completed job and its segments. Raises HTTPException on failure."""
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")
    if job.status != "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Transkriberingen ar inte klar annu",
        )
    seg_result = await session.execute(
        select(Segment)
        .where(Segment.job_id == job_id)
        .order_by(Segment.segment_index)
    )
    return job, list(seg_result.scalars().all())


class CustomWordsJobRequest(BaseModel):
    """Request for running custom words anonymization on a job."""

    template_id: str | None = None
    custom_words: list[WordReplacement] = []


@router.post(
    "/jobs/{job_id}/enhance-anonymization",
    response_model=JobAnonymizationResponse,
)
async def enhance_anonymization(
    job_id: str,
    data: EnhanceAnonymizationRequest | None = None,
    session: AsyncSession = Depends(get_session),
) -> JobAnonymizationResponse:
    """Run pattern-based anonymization on an existing transcript."""
    job, segments = await _get_completed_job_segments(session, job_id)

    pattern_type_filter = data.pattern_types if data else None
    total_entities = 0
    merged_counts: dict[str, int] = {}

    for seg in segments:
        source_text = seg.anonymized_text if seg.anonymized_text else seg.text
        pattern_result = anonymize_patterns(source_text, pattern_types=pattern_type_filter)
        if pattern_result.entities_found > 0:
            seg.anonymized_text = pattern_result.text
            total_entities += pattern_result.entities_found
            if pattern_result.entity_counts:
                for k, v in pattern_result.entity_counts.items():
                    merged_counts[k] = merged_counts.get(k, 0) + v

    await session.commit()

    return JobAnonymizationResponse(
        job_id=job_id,
        segments_processed=len(segments),
        total_entities_found=total_entities,
        message=f"Monsteranonymisering klar. {total_entities} entiteter hittades.",
        entity_counts=merged_counts,
    )


@router.post(
    "/jobs/{job_id}/run-anonymization",
    response_model=JobAnonymizationResponse,
)
async def run_anonymization(
    job_id: str,
    data: RunAnonymizationRequest | None = None,
    session: AsyncSession = Depends(get_session),
) -> JobAnonymizationResponse:
    """Run NER-based anonymization retroactively on a completed transcript."""
    if not is_ner_available():
        raise HTTPException(
            status_code=503,
            detail="NER-modellen ar inte tillganglig. Installera transformers-paketet.",
        )

    job, segments = await _get_completed_job_segments(session, job_id)

    # Use request entity_types if provided, otherwise fall back to job setting
    entity_types = data.entity_types if data and data.entity_types else (
        job.ner_entity_types.split(",") if job.ner_entity_types else None
    )
    pattern_type_filter = data.pattern_types if data else None

    total_entities = 0
    merged_counts: dict[str, int] = {}

    for seg in segments:
        ner_result = await asyncio.to_thread(
            anonymize_ner, seg.text, entity_types=entity_types
        )
        pattern_result = anonymize_patterns(ner_result.text, pattern_types=pattern_type_filter)
        seg.anonymized_text = pattern_result.text
        total_entities += ner_result.entities_found + pattern_result.entities_found

        if ner_result.entity_counts:
            for k, v in ner_result.entity_counts.items():
                merged_counts[k] = merged_counts.get(k, 0) + v
        if pattern_result.entity_counts:
            for k, v in pattern_result.entity_counts.items():
                merged_counts[k] = merged_counts.get(k, 0) + v

    job.enable_anonymization = True
    await session.commit()

    return JobAnonymizationResponse(
        job_id=job_id,
        segments_processed=len(segments),
        total_entities_found=total_entities,
        message=f"NER-anonymisering klar. {total_entities} entiteter hittades.",
        entity_counts=merged_counts,
    )


@router.post(
    "/jobs/{job_id}/apply-custom-words",
    response_model=JobAnonymizationResponse,
)
async def apply_custom_words(
    job_id: str,
    data: CustomWordsJobRequest,
    session: AsyncSession = Depends(get_session),
) -> JobAnonymizationResponse:
    """Apply custom word replacements to a completed transcript."""
    job, segments = await _get_completed_job_segments(session, job_id)

    # Merge template words + inline custom words
    replacements: list[tuple[str, str]] = []
    replacements.extend(
        await _load_template_replacements(session, data.template_id)
    )
    replacements.extend(
        [(w.original, w.replacement) for w in data.custom_words]
    )

    if not replacements:
        raise HTTPException(
            status_code=400,
            detail="Inga anpassade ord angivna.",
        )

    total_entities = 0
    for seg in segments:
        source_text = seg.anonymized_text if seg.anonymized_text else seg.text
        result = anonymize_custom_words(source_text, replacements)
        if result.entities_found > 0:
            seg.anonymized_text = result.text
            total_entities += result.entities_found

    job.enable_anonymization = True
    await session.commit()

    return JobAnonymizationResponse(
        job_id=job_id,
        segments_processed=len(segments),
        total_entities_found=total_entities,
        message=f"Anpassad avidentifiering klar. {total_entities} ersattningar.",
    )
