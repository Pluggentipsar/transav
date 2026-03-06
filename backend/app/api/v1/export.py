"""Export endpoints for transcription results."""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.models.job import Job
from app.models.segment import Segment

logger = logging.getLogger(__name__)

router = APIRouter()


def _format_timestamp_srt(seconds: float) -> str:
    """Format seconds as SRT timestamp: HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def _format_timestamp_vtt(seconds: float) -> str:
    """Format seconds as WebVTT timestamp: HH:MM:SS.mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def _format_timestamp_readable(seconds: float) -> str:
    """Format seconds as readable timestamp: MM:SS"""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"


async def _get_job_with_segments(
    job_id: str,
    session: AsyncSession,
) -> tuple[Job, list[Segment]]:
    """Load a completed job with its segments."""
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
    return job, segments


def _get_text(segment: Segment, anonymized: bool) -> str:
    """Get segment text, optionally anonymized."""
    if anonymized and segment.anonymized_text:
        return segment.anonymized_text
    return segment.text


def _export_txt(job: Job, segments: list[Segment], anonymized: bool) -> str:
    """Export as plain text with speaker labels and timestamps."""
    lines: list[str] = []
    lines.append(f"# {job.name}")
    lines.append(f"# Transkriberad: {job.completed_at}")
    lines.append("")

    for seg in segments:
        timestamp = _format_timestamp_readable(seg.start_time)
        speaker = f"[{seg.speaker}]" if seg.speaker else ""
        text = _get_text(seg, anonymized)
        if speaker:
            lines.append(f"[{timestamp}] {speaker} {text}")
        else:
            lines.append(f"[{timestamp}] {text}")

    return "\n".join(lines)


def _export_md(job: Job, segments: list[Segment], anonymized: bool) -> str:
    """Export as Markdown with headers per speaker."""
    lines: list[str] = []
    lines.append(f"# {job.name}")
    lines.append("")
    lines.append(f"**Transkriberad:** {job.completed_at}  ")
    lines.append(f"**Modell:** {job.model}  ")
    lines.append(f"**Antal segment:** {job.segment_count}  ")
    lines.append(f"**Antal ord:** {job.word_count}  ")
    lines.append("")
    lines.append("---")
    lines.append("")

    current_speaker: str | None = None
    for seg in segments:
        text = _get_text(seg, anonymized)
        timestamp = _format_timestamp_readable(seg.start_time)

        if seg.speaker and seg.speaker != current_speaker:
            current_speaker = seg.speaker
            lines.append(f"### {current_speaker}")
            lines.append("")

        lines.append(f"*[{timestamp}]* {text}")
        lines.append("")

    return "\n".join(lines)


def _export_json(
    job: Job, segments: list[Segment], anonymized: bool
) -> str:
    """Export as JSON with full segment data."""
    data = {
        "job": {
            "id": job.id,
            "name": job.name,
            "file_name": job.file_name,
            "model": job.model,
            "language": job.language,
            "duration_seconds": job.duration_seconds,
            "speaker_count": job.speaker_count,
            "word_count": job.word_count,
            "segment_count": job.segment_count,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        },
        "segments": [
            {
                "index": seg.segment_index,
                "start": seg.start_time,
                "end": seg.end_time,
                "text": _get_text(seg, anonymized),
                "speaker": seg.speaker,
                "confidence": seg.confidence,
            }
            for seg in segments
        ],
    }
    return json.dumps(data, ensure_ascii=False, indent=2)


def _export_srt(segments: list[Segment], anonymized: bool) -> str:
    """Export as SubRip subtitle format."""
    lines: list[str] = []
    for i, seg in enumerate(segments, start=1):
        text = _get_text(seg, anonymized)
        start_ts = _format_timestamp_srt(seg.start_time)
        end_ts = _format_timestamp_srt(seg.end_time)

        speaker_prefix = f"[{seg.speaker}] " if seg.speaker else ""
        lines.append(str(i))
        lines.append(f"{start_ts} --> {end_ts}")
        lines.append(f"{speaker_prefix}{text}")
        lines.append("")

    return "\n".join(lines)


def _export_vtt(segments: list[Segment], anonymized: bool) -> str:
    """Export as WebVTT subtitle format."""
    lines: list[str] = []
    lines.append("WEBVTT")
    lines.append("")

    for i, seg in enumerate(segments, start=1):
        text = _get_text(seg, anonymized)
        start_ts = _format_timestamp_vtt(seg.start_time)
        end_ts = _format_timestamp_vtt(seg.end_time)

        speaker_prefix = f"<v {seg.speaker}>" if seg.speaker else ""
        lines.append(str(i))
        lines.append(f"{start_ts} --> {end_ts}")
        lines.append(f"{speaker_prefix}{text}")
        lines.append("")

    return "\n".join(lines)


EXPORT_FORMATS = {"txt", "md", "json", "srt", "vtt"}

CONTENT_TYPES = {
    "txt": "text/plain; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
    "json": "application/json; charset=utf-8",
    "srt": "text/plain; charset=utf-8",
    "vtt": "text/vtt; charset=utf-8",
}


@router.get("/jobs/{job_id}/export")
async def export_transcript(
    job_id: str,
    format: str = Query("txt", description="Exportformat: txt, md, json, srt, vtt"),
    anonymized: bool = Query(False, description="Anvand anonymiserad text"),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Export transcript in the specified format."""
    if format not in EXPORT_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Format '{format}' stods inte. Tillåtna: {', '.join(sorted(EXPORT_FORMATS))}",
        )

    job, segments = await _get_job_with_segments(job_id, session)

    if format == "txt":
        content = _export_txt(job, segments, anonymized)
    elif format == "md":
        content = _export_md(job, segments, anonymized)
    elif format == "json":
        content = _export_json(job, segments, anonymized)
    elif format == "srt":
        content = _export_srt(segments, anonymized)
    elif format == "vtt":
        content = _export_vtt(segments, anonymized)
    else:
        content = ""

    safe_name = "".join(c if c.isalnum() or c in "-_ " else "_" for c in job.name)
    filename = f"{safe_name}.{format}"

    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type=CONTENT_TYPES[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/jobs/{job_id}/audio")
async def stream_audio(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    """Stream the original audio file."""
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jobb hittades inte")

    file_path = Path(job.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Ljudfil hittades inte pa servern")

    # Determine media type from extension
    ext = file_path.suffix.lower()
    media_types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".webm": "audio/webm",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=job.file_name,
    )
