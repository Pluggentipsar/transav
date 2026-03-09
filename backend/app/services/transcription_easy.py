"""Easytranscriber transcription service — fast Swedish ASR with wav2vec2 alignment."""

import logging
import shutil
import tempfile
from collections.abc import Callable

from app.config import settings
from app.services.transcription import SegmentResult, TranscriptionResult, WordResult

logger = logging.getLogger(__name__)


def is_available() -> bool:
    """Check whether easytranscriber is installed."""
    try:
        import easytranscriber  # noqa: F401

        return True
    except ImportError:
        return False


def transcribe(
    audio_path: str,
    model_name: str = "KBLab/kb-whisper-small",
    language: str = "sv",
    device: str = "auto",
    compute_type: str = "auto",
    progress_callback: Callable[[int, str], None] | None = None,
) -> TranscriptionResult:
    """Transcribe audio using easytranscriber pipeline.

    Uses Silero VAD + KBLab wav2vec2 alignment for better word timestamps.
    """
    from easytranscriber import pipeline, read_json
    from easytranscriber.tokenizer import load_tokenizer

    if progress_callback:
        progress_callback(5, "Laddar easytranscriber-pipeline...")

    tmp_dir = tempfile.mkdtemp(prefix="tysttext_easy_")
    try:
        if progress_callback:
            progress_callback(10, "Konfigurerar pipeline...")

        actual_device = device if device != "auto" else _detect_device()
        actual_compute = compute_type if compute_type != "auto" else _default_compute(actual_device)

        result_path = pipeline(
            audio_file=audio_path,
            vad_model="silero",
            emissions_model="KBLab/wav2vec2-large-voxrex-swedish",
            transcription_model=model_name,
            backend="ct2",
            language=language,
            tokenizer=load_tokenizer("swedish"),
            cache_dir=str(settings.models_path),
            device=actual_device,
            compute_type=actual_compute,
            output_dir=tmp_dir,
        )

        if progress_callback:
            progress_callback(50, "Laser resultat...")

        raw = read_json(result_path)

        if progress_callback:
            progress_callback(70, "Konverterar resultat...")

        return _convert_result(raw, language)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _convert_result(raw: dict, language: str) -> TranscriptionResult:
    """Convert easytranscriber JSON output to TranscriptionResult."""
    segments: list[SegmentResult] = []
    duration = 0.0

    for seg_data in raw.get("segments", []):
        words: list[WordResult] = []
        for w in seg_data.get("words", []):
            words.append(
                WordResult(
                    text=str(w.get("word", w.get("text", ""))).strip(),
                    start=float(w.get("start", 0.0)),
                    end=float(w.get("end", 0.0)),
                    confidence=float(w.get("score", w.get("confidence", 0.0))),
                )
            )

        seg_end = float(seg_data.get("end", 0.0))
        segments.append(
            SegmentResult(
                text=str(seg_data.get("text", "")).strip(),
                start=float(seg_data.get("start", 0.0)),
                end=seg_end,
                words=words,
            )
        )
        duration = max(duration, seg_end)

    # Use top-level duration if available
    if raw.get("duration"):
        duration = float(raw["duration"])

    return TranscriptionResult(
        segments=segments,
        language=language,
        duration=duration,
    )


def _detect_device() -> str:
    """Detect available device (CUDA or CPU)."""
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    return "cpu"


def _default_compute(device: str) -> str:
    """Default compute type based on device."""
    return "float16" if device == "cuda" else "int8"
