"""Editor endpoints for word-level transcript editing and audio export."""

import logging
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_session
from app.models.job import Job
from app.models.segment import Segment
from app.models.word import Word

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Request/Response schemas ---


class EditableWord(BaseModel):
    """Word with timing and inclusion status for the editor."""

    id: int
    segment_id: int
    word_index: int
    start_time: float
    end_time: float
    text: str
    confidence: float | None
    included: bool
    speaker: str | None

    model_config = {"from_attributes": True}


class EditableTranscriptResponse(BaseModel):
    """Full editable transcript with word-level data."""

    job_id: str
    job_name: str
    duration_seconds: float | None
    words: list[EditableWord]
    total_words: int


class WordEditRequest(BaseModel):
    """Request to toggle word inclusion."""

    word_ids: list[int]
    included: bool


class WordEditResponse(BaseModel):
    """Response after editing words."""

    updated_count: int
    message: str


class ResetEditsResponse(BaseModel):
    """Response after resetting edits."""

    reset_count: int
    message: str


# --- Endpoints ---


@router.get("/{job_id}/editable-transcript", response_model=EditableTranscriptResponse)
async def get_editable_transcript(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> EditableTranscriptResponse:
    """Get words with timing and inclusion status for the editor."""
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")

    if job.status != "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Transkriberingen ar inte klar annu",
        )

    # Load segments with words
    seg_result = await session.execute(
        select(Segment)
        .where(Segment.job_id == job_id)
        .options(selectinload(Segment.words))
        .order_by(Segment.segment_index)
    )
    segments = list(seg_result.scalars().all())

    editable_words: list[EditableWord] = []
    for seg in segments:
        sorted_words = sorted(seg.words, key=lambda w: w.word_index)
        for w in sorted_words:
            editable_words.append(
                EditableWord(
                    id=w.id,
                    segment_id=w.segment_id,
                    word_index=w.word_index,
                    start_time=w.start_time,
                    end_time=w.end_time,
                    text=w.text,
                    confidence=w.confidence,
                    included=w.included,
                    speaker=seg.speaker,
                )
            )

    return EditableTranscriptResponse(
        job_id=job_id,
        job_name=job.name,
        duration_seconds=job.duration_seconds,
        words=editable_words,
        total_words=len(editable_words),
    )


@router.post("/{job_id}/words/edit", response_model=WordEditResponse)
async def edit_words(
    job_id: str,
    data: WordEditRequest,
    session: AsyncSession = Depends(get_session),
) -> WordEditResponse:
    """Toggle word inclusion status."""
    # Verify job exists
    job_result = await session.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")

    if not data.word_ids:
        raise HTTPException(status_code=400, detail="Inga ord-ID angavs")

    # Get words that belong to this job (via segments)
    word_result = await session.execute(
        select(Word)
        .join(Segment, Word.segment_id == Segment.id)
        .where(Segment.job_id == job_id, Word.id.in_(data.word_ids))
    )
    words = list(word_result.scalars().all())

    if not words:
        raise HTTPException(status_code=404, detail="Inga matchande ord hittades")

    for word in words:
        word.included = data.included

    await session.commit()

    status = "inkluderade" if data.included else "exkluderade"
    return WordEditResponse(
        updated_count=len(words),
        message=f"{len(words)} ord {status}",
    )


@router.post("/{job_id}/reset-edits", response_model=ResetEditsResponse)
async def reset_edits(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> ResetEditsResponse:
    """Reset all words to included."""
    # Verify job exists
    job_result = await session.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")

    # Get all words for this job
    word_result = await session.execute(
        select(Word)
        .join(Segment, Word.segment_id == Segment.id)
        .where(Segment.job_id == job_id, Word.included == False)  # noqa: E712
    )
    excluded_words = list(word_result.scalars().all())

    for word in excluded_words:
        word.included = True

    await session.commit()

    return ResetEditsResponse(
        reset_count=len(excluded_words),
        message=f"{len(excluded_words)} ord aterstallda till inkluderade",
    )


@router.get("/{job_id}/download-edited-audio")
async def download_edited_audio(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    """Generate edited audio with ffmpeg, excluding non-included words."""
    # Verify job exists
    job_result = await session.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")

    source_path = Path(job.file_path)
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Ljudfil hittades inte pa servern")

    # Get included words sorted by time
    word_result = await session.execute(
        select(Word)
        .join(Segment, Word.segment_id == Segment.id)
        .where(Segment.job_id == job_id, Word.included == True)  # noqa: E712
        .order_by(Word.start_time)
    )
    included_words = list(word_result.scalars().all())

    if not included_words:
        raise HTTPException(
            status_code=400,
            detail="Inga inkluderade ord att exportera",
        )

    # Merge adjacent/overlapping time ranges to reduce ffmpeg segments
    time_ranges: list[tuple[float, float]] = []
    for word in included_words:
        if time_ranges and word.start_time <= time_ranges[-1][1] + 0.05:
            # Extend the current range (with 50ms tolerance for adjacent words)
            time_ranges[-1] = (time_ranges[-1][0], max(time_ranges[-1][1], word.end_time))
        else:
            time_ranges.append((word.start_time, word.end_time))

    # Build ffmpeg filter to concatenate included segments
    filter_parts: list[str] = []
    for i, (start, end) in enumerate(time_ranges):
        filter_parts.append(
            f"[0:a]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS[a{i}]"
        )

    # Concatenate all segments
    concat_inputs = "".join(f"[a{i}]" for i in range(len(time_ranges)))
    filter_parts.append(f"{concat_inputs}concat=n={len(time_ranges)}:v=0:a=1[out]")

    filter_complex = ";".join(filter_parts)

    # Create temp output file
    suffix = source_path.suffix if source_path.suffix else ".wav"
    tmp_file = tempfile.NamedTemporaryFile(
        suffix=f"_edited{suffix}", delete=False, dir=str(source_path.parent)
    )
    tmp_path = tmp_file.name
    tmp_file.close()

    try:
        cmd = [
            "ffmpeg",
            "-y",
            "-i", str(source_path),
            "-filter_complex", filter_complex,
            "-map", "[out]",
            tmp_path,
        ]

        logger.info("Running ffmpeg for edited audio: %s segments", len(time_ranges))
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
        )

        if result.returncode != 0:
            logger.error("ffmpeg error: %s", result.stderr)
            raise HTTPException(
                status_code=500,
                detail="Kunde inte skapa redigerat ljud. Kontrollera att ffmpeg ar installerat.",
            )

        safe_name = "".join(c if c.isalnum() or c in "-_ " else "_" for c in job.name)
        filename = f"{safe_name}_redigerad{suffix}"

        return FileResponse(
            path=tmp_path,
            media_type="audio/mpeg" if suffix == ".mp3" else "audio/wav",
            filename=filename,
            background=None,  # Keep file until response is sent
        )

    except subprocess.TimeoutExpired as err:
        Path(tmp_path).unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Tidsgrans for ljud-export overskreds",
        ) from err
    except HTTPException:
        raise
    except Exception as e:
        Path(tmp_path).unlink(missing_ok=True)
        logger.exception("Failed to create edited audio")
        raise HTTPException(
            status_code=500,
            detail=f"Fel vid skapande av redigerat ljud: {e}",
        ) from e
