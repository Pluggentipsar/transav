"""Anonymization endpoints for standalone and job-based anonymization."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.models.job import Job
from app.models.segment import Segment
from app.services.anonymization import (
    anonymize_ner,
    anonymize_patterns,
    is_ner_available,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Request/Response schemas ---


class AnonymizeTextRequest(BaseModel):
    """Request for standalone text anonymization."""

    text: str
    use_ner: bool = True
    use_patterns: bool = True


class AnonymizeTextResponse(BaseModel):
    """Response from text anonymization."""

    original_text: str
    anonymized_text: str
    entities_found: int


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


# --- Endpoints ---


@router.post("/anonymize", response_model=AnonymizeTextResponse)
async def anonymize_text(data: AnonymizeTextRequest) -> AnonymizeTextResponse:
    """Standalone text anonymization."""
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Ingen text att anonymisera")

    anonymized = data.text
    total_entities = 0

    if data.use_ner:
        if not is_ner_available():
            logger.warning("NER requested but not available")
        else:
            ner_result = anonymize_ner(data.text)
            anonymized = ner_result.text
            total_entities += ner_result.entities_found

    if data.use_patterns:
        pattern_result = anonymize_patterns(anonymized)
        anonymized = pattern_result.text
        total_entities += pattern_result.entities_found

    return AnonymizeTextResponse(
        original_text=data.text,
        anonymized_text=anonymized,
        entities_found=total_entities,
    )


@router.get("/anonymize/status", response_model=AnonymizeStatusResponse)
async def anonymize_status() -> AnonymizeStatusResponse:
    """Check if NER model and pattern engine are available."""
    from app.services.anonymization import INSTITUTION_PATTERNS, PATTERNS

    return AnonymizeStatusResponse(
        ner_available=is_ner_available(),
        ner_model="KB/bert-base-swedish-cased-ner",
        patterns_available=True,
        pattern_count=len(PATTERNS) + len(INSTITUTION_PATTERNS),
    )


@router.post(
    "/jobs/{job_id}/enhance-anonymization",
    response_model=JobAnonymizationResponse,
)
async def enhance_anonymization(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> JobAnonymizationResponse:
    """Run pattern-based anonymization on an existing transcript."""
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
    segments = list(seg_result.scalars().all())

    total_entities = 0
    for seg in segments:
        # Apply patterns to the base text (or to already anonymized text)
        source_text = seg.anonymized_text if seg.anonymized_text else seg.text
        pattern_result = anonymize_patterns(source_text)
        if pattern_result.entities_found > 0:
            seg.anonymized_text = pattern_result.text
            total_entities += pattern_result.entities_found

    await session.commit()

    return JobAnonymizationResponse(
        job_id=job_id,
        segments_processed=len(segments),
        total_entities_found=total_entities,
        message=f"Monsteranonymisering klar. {total_entities} entiteter hittades.",
    )


@router.post(
    "/jobs/{job_id}/run-anonymization",
    response_model=JobAnonymizationResponse,
)
async def run_anonymization(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> JobAnonymizationResponse:
    """Run NER-based anonymization retroactively on a completed transcript."""
    if not is_ner_available():
        raise HTTPException(
            status_code=503,
            detail="NER-modellen ar inte tillganglig. Installera transformers-paketet.",
        )

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
    segments = list(seg_result.scalars().all())

    entity_types = job.ner_entity_types.split(",") if job.ner_entity_types else None

    total_entities = 0
    for seg in segments:
        # Run NER on the original text
        ner_result = anonymize_ner(seg.text, entity_types=entity_types)
        # Then apply patterns on top
        pattern_result = anonymize_patterns(ner_result.text)

        seg.anonymized_text = pattern_result.text
        total_entities += ner_result.entities_found + pattern_result.entities_found

    # Update job to reflect anonymization was run
    job.enable_anonymization = True
    await session.commit()

    return JobAnonymizationResponse(
        job_id=job_id,
        segments_processed=len(segments),
        total_entities_found=total_entities,
        message=f"NER-anonymisering klar. {total_entities} entiteter hittades.",
    )
