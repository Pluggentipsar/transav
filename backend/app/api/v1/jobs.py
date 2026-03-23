"""Job CRUD, transcript, and search endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.models.job import Job
from app.models.segment import Segment
from app.schemas.job import (
    JobCreate,
    JobListResponse,
    JobResponse,
    JobUpdate,
    SpeakerAnalysis,
    TranscriptAnalysis,
    WordFrequency,
)
from app.schemas.segment import (
    SpeakerRenameRequest,
    TranscriptResponse,
)

logger = logging.getLogger(__name__)

SWEDISH_STOP_WORDS = {
    "och", "i", "att", "det", "som", "en", "på", "är", "av", "för",
    "med", "till", "den", "har", "inte", "om", "ett", "men", "var",
    "jag", "de", "så", "vi", "kan", "han", "hade", "hon", "mitt",
    "ska", "skulle", "från", "där", "alla", "kommer", "nu", "hur",
    "eller", "vad", "sina", "här", "ha", "mot", "när",
    "vara", "något", "ut", "sig", "dem", "oss", "upp", "dig",
    "mig", "då", "man", "mycket", "sedan", "ju", "denna", "bara",
    "nog", "efter", "redan", "min", "din", "just", "liksom",
    "ja", "nej", "mm", "ehm", "öh", "eh", "va", "jo", "hmm",
    "alltså", "typ", "asså",
}

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


@router.get("/{job_id}/analysis", response_model=TranscriptAnalysis)
async def get_analysis(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> TranscriptAnalysis:
    """Return analysis data for a completed transcription."""
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")

    if job.status != "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Transkriberingen ar inte klar annu",
        )

    # Fetch all segments with their words eagerly
    from sqlalchemy.orm import selectinload

    seg_result = await session.execute(
        select(Segment)
        .where(Segment.job_id == job_id)
        .options(selectinload(Segment.words))
        .order_by(Segment.segment_index)
    )
    segments = list(seg_result.scalars().all())

    total_segments = len(segments)
    total_duration = job.duration_seconds or 0.0

    # Collect all words and compute frequencies
    from collections import Counter

    word_counter: Counter[str] = Counter()
    total_words = 0
    all_unique_words: set[str] = set()

    # Per-speaker accumulators
    speaker_data: dict[str, dict[str, float | int]] = {}

    for segment in segments:
        speaker = segment.speaker or "Okand"

        if speaker not in speaker_data:
            speaker_data[speaker] = {
                "word_count": 0,
                "talk_time": 0.0,
                "segment_count": 0,
            }

        seg_duration = segment.end_time - segment.start_time
        speaker_data[speaker]["talk_time"] += seg_duration  # type: ignore[operator]
        speaker_data[speaker]["segment_count"] += 1  # type: ignore[operator]

        # Count words from segment text (for frequency + totals)
        segment_words = segment.text.strip().split()
        for w in segment_words:
            cleaned = w.strip(".,!?;:\"'()[]{}–-…").lower()
            if not cleaned:
                continue
            total_words += 1
            all_unique_words.add(cleaned)
            speaker_data[speaker]["word_count"] += 1  # type: ignore[operator]
            if cleaned not in SWEDISH_STOP_WORDS:
                word_counter[cleaned] += 1

    # Build word frequency list (top 30)
    word_frequencies = [
        WordFrequency(word=word, count=count)
        for word, count in word_counter.most_common(30)
    ]

    # Build speaker analysis
    speakers: list[SpeakerAnalysis] = []
    for name, data in speaker_data.items():
        wc = int(data["word_count"])
        talk_time = float(data["talk_time"])
        seg_count = int(data["segment_count"])
        talk_pct = (talk_time / total_duration * 100) if total_duration > 0 else 0.0
        wpm = (wc / talk_time * 60) if talk_time > 0 else 0.0

        speakers.append(SpeakerAnalysis(
            name=name,
            word_count=wc,
            talk_time=round(talk_time, 2),
            segment_count=seg_count,
            talk_percentage=round(talk_pct, 1),
            words_per_minute=round(wpm, 1),
        ))

    # Sort speakers by talk time descending
    speakers.sort(key=lambda s: s.talk_time, reverse=True)

    # Overall statistics
    avg_wpm = (total_words / total_duration * 60) if total_duration > 0 else 0.0
    avg_seg_len = (total_duration / total_segments) if total_segments > 0 else 0.0

    return TranscriptAnalysis(
        total_duration=round(total_duration, 2),
        total_words=total_words,
        total_segments=total_segments,
        unique_words=len(all_unique_words),
        avg_words_per_minute=round(avg_wpm, 1),
        avg_segment_length=round(avg_seg_len, 2),
        word_frequencies=word_frequencies,
        speakers=speakers,
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
