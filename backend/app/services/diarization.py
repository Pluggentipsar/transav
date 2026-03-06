"""Speaker diarization service using WhisperX + pyannote."""

import logging
from collections.abc import Callable

logger = logging.getLogger(__name__)


def is_available() -> bool:
    """Check if diarization dependencies are installed."""
    try:
        import whisperx  # noqa: F401

        return True
    except ImportError:
        return False


def diarize(
    audio_path: str,
    segments: list[dict[str, object]],
    hf_token: str,
    device: str = "cpu",
    progress_callback: Callable[[int, str], None] | None = None,
) -> list[dict[str, object]]:
    """Run speaker diarization on transcription segments.

    Args:
        audio_path: Path to the audio file
        segments: Transcription segments from faster-whisper
        hf_token: HuggingFace token (required for pyannote gated models)
        device: Device (cpu/cuda)
        progress_callback: Progress callback (70-90% range)

    Returns:
        Segments with speaker labels added
    """
    if not hf_token:
        logger.warning("HuggingFace-token saknas - kan inte kora talaridentifiering")
        return segments

    try:
        import whisperx
    except ImportError:
        logger.warning("whisperx ej installerat - hoppar over talaridentifiering")
        return segments

    if progress_callback:
        progress_callback(72, "Laddar talaridentifiering...")

    audio = whisperx.load_audio(audio_path)

    if progress_callback:
        progress_callback(78, "Identifierar talare...")

    diarize_model = whisperx.DiarizePipeline(use_auth_token=hf_token, device=device)
    diarize_segments = diarize_model(audio)

    if progress_callback:
        progress_callback(85, "Tilldelar talare till segment...")

    result = whisperx.assign_word_speakers(diarize_segments, {"segments": segments})

    if progress_callback:
        progress_callback(90, "Talaridentifiering klar")

    return result.get("segments", segments)  # type: ignore[no-any-return]
