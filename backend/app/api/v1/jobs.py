"""Job CRUD, transcript, and search endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.models.job import Job
from app.models.segment import Segment
from app.schemas.job import JobCreate, JobListResponse, JobResponse, JobUpdate
from app.schemas.segment import (
    SpeakerRenameRequest,
    TranscriptResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=JobResponse)
async def create_job(
    data: JobCreate,
    session: AsyncSession = Depends(get_session),
) -> Job:
    """Create a new transcription job and start processing."""
    from pathlib import Path

    file_path = Path(data.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Ljudfil hittades inte")

    from datetime import datetime

    default_name = datetime.now().strftime("Transkription %Y-%m-%d %H:%M")
    job = Job(
        name=data.name or default_name,
        file_name=file_path.name,
        file_path=str(file_path),
        file_size=file_path.stat().st_size,
        engine=data.engine,
        model=data.model,
        language=data.language,
        enable_diarization=data.enable_diarization,
        enable_anonymization=data.enable_anonymization,
        ner_entity_types=data.ner_entity_types,
        anonymize_template_id=data.anonymize_template_id,
        status="PENDING",
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)

    # Start background transcription task
    from app.workers.transcription_worker import start_transcription

    start_transcription(job.id)

    return job


@router.get("/search/global", response_model=JobListResponse)
async def search_jobs(
    q: str = Query(..., min_length=1, description="Sokterm"),
    session: AsyncSession = Depends(get_session),
) -> JobListResponse:
    """Full-text search across all transcriptions."""
    search_term = f"%{q}%"

    # Search in job names
    job_name_query = select(Job.id).where(Job.name.ilike(search_term))

    # Search in segment texts
    segment_query = (
        select(Segment.job_id)
        .where(
            Segment.text.ilike(search_term)
            | Segment.anonymized_text.ilike(search_term)
        )
        .distinct()
    )

    # Combine results
    job_name_result = await session.execute(job_name_query)
    segment_result = await session.execute(segment_query)

    matching_ids: set[str] = set()
    for row in job_name_result.scalars().all():
        matching_ids.add(row)
    for row in segment_result.scalars().all():
        matching_ids.add(row)

    if not matching_ids:
        return JobListResponse(jobs=[], total=0)

    result = await session.execute(
        select(Job)
        .where(Job.id.in_(matching_ids))
        .order_by(Job.created_at.desc())
    )
    jobs = list(result.scalars().all())

    return JobListResponse(jobs=jobs, total=len(jobs))


@router.get("/{job_id}/transcript", response_model=TranscriptResponse)
async def get_transcript(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> TranscriptResponse:
    """Return full transcript with segments for a job."""
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

    return TranscriptResponse(
        job_id=job_id,
        segments=segments,
        total_segments=len(segments),
    )


@router.post("/{job_id}/rename-speaker", response_model=TranscriptResponse)
async def rename_speaker(
    job_id: str,
    data: SpeakerRenameRequest,
    session: AsyncSession = Depends(get_session),
) -> TranscriptResponse:
    """Rename a speaker across all segments in a job."""
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")

    seg_result = await session.execute(
        select(Segment)
        .where(Segment.job_id == job_id, Segment.speaker == data.old_name)
    )
    segments_to_update = list(seg_result.scalars().all())

    if not segments_to_update:
        raise HTTPException(
            status_code=404,
            detail=f"Talare '{data.old_name}' hittades inte",
        )

    for seg in segments_to_update:
        seg.speaker = data.new_name

    await session.commit()

    # Return updated transcript
    all_seg_result = await session.execute(
        select(Segment)
        .where(Segment.job_id == job_id)
        .order_by(Segment.segment_index)
    )
    all_segments = list(all_seg_result.scalars().all())

    return TranscriptResponse(
        job_id=job_id,
        segments=all_segments,
        total_segments=len(all_segments),
    )


@router.get("", response_model=JobListResponse)
async def list_jobs(
    skip: int = 0,
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
) -> JobListResponse:
    """List all jobs, newest first."""
    result = await session.execute(
        select(Job).order_by(Job.created_at.desc()).offset(skip).limit(limit)
    )
    jobs = list(result.scalars().all())

    count_result = await session.execute(select(func.count(Job.id)))
    total = count_result.scalar_one()

    return JobListResponse(jobs=jobs, total=total)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> Job:
    """Get a single job by ID."""
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")
    return job


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    data: JobUpdate,
    session: AsyncSession = Depends(get_session),
) -> Job:
    """Update job name."""
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")

    if data.name is not None:
        job.name = data.name

    await session.commit()
    await session.refresh(job)
    return job


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Delete a job and its associated files."""
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")

    # Delete uploaded file
    from pathlib import Path

    file_path = Path(job.file_path)
    if file_path.exists():
        file_path.unlink()

    await session.delete(job)
    await session.commit()
    return {"status": "deleted"}
