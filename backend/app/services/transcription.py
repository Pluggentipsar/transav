"""KB-Whisper transcription service using faster-whisper."""

import logging
from collections.abc import Callable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Model cache to avoid reloading
_model_cache: dict[str, object] = {}


@dataclass
class WordResult:
    text: str
    start: float
    end: float
    confidence: float


@dataclass
class SegmentResult:
    text: str
    start: float
    end: float
    words: list[WordResult] = field(default_factory=list)


@dataclass
class TranscriptionResult:
    segments: list[SegmentResult]
    language: str
    duration: float


def clear_model_cache() -> None:
    """Clear cached models to free GPU memory."""
    _model_cache.clear()
    logger.info("Model cache cleared")


def transcribe(
    audio_path: str,
    model_name: str = "KBLab/kb-whisper-small",
    language: str = "sv",
    device: str = "auto",
    compute_type: str = "auto",
    progress_callback: Callable[[int, str], None] | None = None,
) -> TranscriptionResult:
    """Transcribe audio file using faster-whisper with KB-Whisper model.

    Args:
        audio_path: Path to the audio file
        model_name: KB-Whisper model name
        language: Language code (default: Swedish)
        device: Device to use (auto/cpu/cuda)
        compute_type: Compute type (auto/int8/float16)
        progress_callback: Callback for progress updates (progress_pct, step_text)

    Returns:
        TranscriptionResult with segments, words, and metadata
    """
    from faster_whisper import WhisperModel

    if progress_callback:
        progress_callback(5, "Laddar modell...")

    # Load or get cached model
    cache_key = f"{model_name}_{device}_{compute_type}"
    if cache_key not in _model_cache:
        actual_device = device if device != "auto" else _detect_device()
        actual_compute = compute_type if compute_type != "auto" else _default_compute(actual_device)

        _model_cache[cache_key] = WhisperModel(
            model_name,
            device=actual_device,
            compute_type=actual_compute,
        )
        logger.info("Loaded model %s on %s", model_name, actual_device)

    model = _model_cache[cache_key]

    if progress_callback:
        progress_callback(10, "Transkriberar...")

    segments_iter, info = model.transcribe(  # type: ignore[union-attr]
        audio_path,
        language=language if language != "auto" else None,
        word_timestamps=True,
        vad_filter=True,
    )

    segments: list[SegmentResult] = []
    total_duration = info.duration or 0.0

    for seg in segments_iter:
        words = [
            WordResult(
                text=w.word.strip(),
                start=w.start,
                end=w.end,
                confidence=w.probability,
            )
            for w in (seg.words or [])
        ]

        segments.append(
            SegmentResult(
                text=seg.text.strip(),
                start=seg.start,
                end=seg.end,
                words=words,
            )
        )

        # Update progress (5-70% range)
        if progress_callback and total_duration > 0:
            pct = int(5 + (seg.end / total_duration) * 65)
            progress_callback(min(pct, 70), "Transkriberar...")

    return TranscriptionResult(
        segments=segments,
        language=info.language or language,
        duration=total_duration,
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
