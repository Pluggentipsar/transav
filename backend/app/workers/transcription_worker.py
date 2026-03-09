"""Background transcription worker using ThreadPoolExecutor."""

import logging
import queue
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

# Thread pool for background processing (max 2 concurrent jobs)
_executor = ThreadPoolExecutor(max_workers=2)

# Progress queues keyed by job_id
_progress_queues: dict[str, queue.Queue[tuple[int, str]]] = {}

# Sync engine for thread-based DB access
_sync_db_url = settings.database_url.replace("+aiosqlite", "")
_sync_engine = create_engine(_sync_db_url)
_SyncSession = sessionmaker(bind=_sync_engine)


def start_transcription(job_id: str) -> None:
    """Submit a transcription job to the thread pool."""
    _progress_queues[job_id] = queue.Queue()
    _executor.submit(_process_job, job_id)
    logger.info("Started transcription job %s", job_id)


def get_progress(job_id: str) -> tuple[int, str] | None:
    """Get the latest progress update for a job."""
    q = _progress_queues.get(job_id)
    if not q:
        return None
    latest = None
    while not q.empty():
        try:
            latest = q.get_nowait()
        except queue.Empty:
            break
    return latest


def _progress_callback(job_id: str, progress: int, step: str) -> None:
    """Thread-safe progress reporting via queue and DB update."""
    q = _progress_queues.get(job_id)
    if q:
        q.put((progress, step))

    # Also persist progress to DB so polling endpoints see it
    try:
        session = _SyncSession()
        try:
            from app.models.job import Job

            job = session.get(Job, job_id)
            if job:
                job.progress = progress
                job.current_step = step
                session.commit()
        finally:
            session.close()
    except Exception:
        logger.debug("Could not persist progress to DB", exc_info=True)


def _process_job(job_id: str) -> None:
    """Process a transcription job (runs in thread pool).

    Steps:
    1. Load job from DB
    2. Run transcription (5-70%)
    3. Run diarization if enabled (70-90%)
    4. Run anonymization if enabled (90-95%)
    5. Save results to DB (95-100%)
    """
    from app.models.job import Job
    from app.models.segment import Segment
    from app.models.word import Word
    from app.services.transcription import transcribe

    session = _SyncSession()
    try:
        # 1. Load job
        job = session.get(Job, job_id)
        if not job:
            logger.error("Job %s not found in DB", job_id)
            return

        # Update to PROCESSING
        job.status = "PROCESSING"
        job.started_at = datetime.utcnow()
        job.progress = 0
        job.current_step = "Startar..."
        session.commit()

        def progress_cb(pct: int, step: str) -> None:
            _progress_callback(job_id, pct, step)

        # 2. Run transcription (5-70%) — dispatch to correct engine
        progress_cb(5, "Startar transkribering...")
        engine = getattr(job, "engine", "faster-whisper") or "faster-whisper"

        if engine == "easytranscriber":
            from app.services.transcription_easy import transcribe as transcribe_easy

            result = transcribe_easy(
                audio_path=job.file_path,
                model_name=job.model,
                language=job.language,
                device=settings.default_device,
                compute_type=settings.default_compute_type,
                progress_callback=progress_cb,
            )
        else:
            result = transcribe(
                audio_path=job.file_path,
                model_name=job.model,
                language=job.language,
                device=settings.default_device,
                compute_type=settings.default_compute_type,
                progress_callback=progress_cb,
            )

        # Convert to dicts for diarization compatibility
        segments_data: list[dict[str, object]] = []
        for seg_result in result.segments:
            seg_dict: dict[str, object] = {
                "text": seg_result.text,
                "start": seg_result.start,
                "end": seg_result.end,
                "words": [
                    {
                        "word": w.text,
                        "start": w.start,
                        "end": w.end,
                        "score": w.confidence,
                    }
                    for w in seg_result.words
                ],
            }
            segments_data.append(seg_dict)

        # 3. Run diarization if enabled (70-90%)
        speakers: set[str] = set()
        if job.enable_diarization:
            progress_cb(70, "Startar talaridentifiering...")
            from app.services.diarization import diarize

            segments_data = diarize(
                audio_path=job.file_path,
                segments=segments_data,
                hf_token=settings.hf_token,
                device=settings.default_device if settings.default_device != "auto" else "cpu",
                progress_callback=progress_cb,
            )

            for seg in segments_data:
                speaker = seg.get("speaker")
                if speaker:
                    speakers.add(str(speaker))
        else:
            progress_cb(90, "Hoppar over talaridentifiering")

        # 4. Run anonymization if enabled (90-95%)
        if job.enable_anonymization:
            progress_cb(90, "Anonymiserar...")
            from app.services.anonymization import (
                anonymize_custom_words,
                anonymize_ner,
                anonymize_patterns,
            )

            entity_types = (
                job.ner_entity_types.split(",") if job.ner_entity_types else None
            )

            # Load custom word replacements from template
            custom_replacements: list[tuple[str, str]] = []
            template_id = getattr(job, "anonymize_template_id", None)
            if template_id:
                from app.models.template import WordTemplate

                template = session.get(WordTemplate, template_id)
                if template:
                    import json

                    try:
                        words = json.loads(template.words_json)
                        custom_replacements = [
                            (w["original"], w["replacement"]) for w in words
                        ]
                    except (json.JSONDecodeError, KeyError):
                        logger.warning("Failed to parse template %s", template_id)

            for seg in segments_data:
                text = str(seg.get("text", ""))

                # Run NER anonymization
                ner_result = anonymize_ner(text, entity_types=entity_types)
                # Then run pattern anonymization on top
                pattern_result = anonymize_patterns(ner_result.text)
                # Then run custom word replacements
                if custom_replacements:
                    custom_result = anonymize_custom_words(
                        pattern_result.text, custom_replacements
                    )
                    seg["anonymized_text"] = custom_result.text
                else:
                    seg["anonymized_text"] = pattern_result.text
        else:
            progress_cb(95, "Hoppar over anonymisering")

        # 5. Save results to DB (95-100%)
        progress_cb(95, "Sparar resultat...")

        total_words = 0
        for seg_idx, seg in enumerate(segments_data):
            db_segment = Segment(
                job_id=job_id,
                segment_index=seg_idx,
                start_time=float(seg.get("start", 0.0)),
                end_time=float(seg.get("end", 0.0)),
                text=str(seg.get("text", "")),
                anonymized_text=(
                    str(seg.get("anonymized_text", ""))
                    if seg.get("anonymized_text") else None
                ),
                speaker=str(seg.get("speaker", "")) if seg.get("speaker") else None,
            )
            session.add(db_segment)
            session.flush()  # Get segment ID

            # Save word-level data
            words_data = seg.get("words", [])
            if isinstance(words_data, list):
                for w_idx, w in enumerate(words_data):
                    if isinstance(w, dict):
                        word_text = str(w.get("word", w.get("text", "")))
                        word_start = float(w.get("start", 0.0))
                        word_end = float(w.get("end", 0.0))
                        word_conf = w.get("score", w.get("confidence"))
                        word_conf = float(word_conf) if word_conf is not None else None
                    else:
                        # Assume it has attributes from SegmentResult.words
                        word_text = str(getattr(w, "text", getattr(w, "word", "")))
                        word_start = float(getattr(w, "start", 0.0))
                        word_end = float(getattr(w, "end", 0.0))
                        word_conf_val = getattr(w, "confidence", getattr(w, "score", None))
                        word_conf = float(word_conf_val) if word_conf_val is not None else None

                    db_word = Word(
                        segment_id=db_segment.id,
                        word_index=w_idx,
                        start_time=word_start,
                        end_time=word_end,
                        text=word_text,
                        confidence=word_conf,
                        included=True,
                    )
                    session.add(db_word)
                    total_words += 1

        # Update job with statistics
        job.status = "COMPLETED"
        job.progress = 100
        job.current_step = "Klar"
        job.completed_at = datetime.utcnow()
        job.duration_seconds = result.duration
        job.segment_count = len(segments_data)
        job.word_count = total_words
        job.speaker_count = len(speakers) if speakers else (1 if segments_data else 0)

        session.commit()
        progress_cb(100, "Klar")
        logger.info(
            "Job %s completed: %d segments, %d words",
            job_id,
            len(segments_data),
            total_words,
        )

    except Exception as e:
        logger.exception("Job %s failed: %s", job_id, e)
        try:
            session.rollback()
            job = session.get(Job, job_id)
            if job:
                job.status = "FAILED"
                job.error_message = str(e)[:500]
                job.current_step = "Fel uppstod"
                session.commit()
        except Exception:
            logger.exception("Failed to update job status to FAILED")
    finally:
        session.close()
        # Cleanup progress queue
        _progress_queues.pop(job_id, None)
