"""Speaker diarization service using WhisperX + pyannote."""

import logging
import os
from collections.abc import Callable
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# Model directory name used for local bundled pyannote model
_PYANNOTE_MODEL_DIR = "pyannote/speaker-diarization-community-1"


def get_local_model_path() -> str | None:
    """Return the local pyannote model path if it exists, otherwise None.

    Checks in order:
    1. PYANNOTE_MODEL_PATH environment variable
    2. {TYSTTEXT_DATA_DIR}/models/pyannote/speaker-diarization-community-1/
    3. {settings.models_path}/pyannote/speaker-diarization-community-1/
    """
    # 1. Explicit env override
    env_path = os.environ.get("PYANNOTE_MODEL_PATH")
    if env_path:
        p = Path(env_path)
        if p.is_dir() and (p / "config.yaml").exists():
            logger.debug("Pyannote model found via PYANNOTE_MODEL_PATH: %s", p)
            return str(p)
        logger.warning(
            "PYANNOTE_MODEL_PATH is set to %s but config.yaml not found there", env_path
        )

    # 2. TYSTTEXT_DATA_DIR/models/...
    data_dir = os.environ.get("TYSTTEXT_DATA_DIR")
    if data_dir:
        p = Path(data_dir) / "models" / _PYANNOTE_MODEL_DIR
        if p.is_dir() and (p / "config.yaml").exists():
            logger.debug("Pyannote model found in TYSTTEXT_DATA_DIR: %s", p)
            return str(p)

    # 3. settings.models_path/...
    p = settings.models_path / _PYANNOTE_MODEL_DIR
    if p.is_dir() and (p / "config.yaml").exists():
        logger.debug("Pyannote model found in models_path: %s", p)
        return str(p)

    return None


def is_available() -> bool:
    """Check if diarization dependencies are installed."""
    try:
        import whisperx  # noqa: F401

        return True
    except ImportError:
        return False


def _pyannote_installed() -> bool:
    """Check if pyannote.audio can be imported."""
    try:
        import pyannote.audio  # noqa: F401

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

    Tries local pyannote model first. Falls back to WhisperX + HF token.

    Args:
        audio_path: Path to the audio file
        segments: Transcription segments from faster-whisper
        hf_token: HuggingFace token (required if no local model)
        device: Device (cpu/cuda)
        progress_callback: Progress callback (70-90% range)

    Returns:
        Segments with speaker labels added
    """
    local_model_path = get_local_model_path()

    if local_model_path:
        logger.info("Anvander lokal pyannote-modell: %s", local_model_path)
        return _diarize_local(audio_path, segments, local_model_path, device, progress_callback)

    # Fallback: WhisperX with HF token
    if not hf_token:
        logger.warning("HuggingFace-token saknas - kan inte kora talaridentifiering")
        return segments

    try:
        import whisperx  # noqa: F811
    except ImportError:
        logger.warning("whisperx ej installerat - hoppar over talaridentifiering")
        return segments

    logger.info("Anvander WhisperX med HuggingFace-token for talaridentifiering")
    return _diarize_whisperx(audio_path, segments, hf_token, device, progress_callback)


def _diarize_local(
    audio_path: str,
    segments: list[dict[str, object]],
    model_path: str,
    device: str,
    progress_callback: Callable[[int, str], None] | None,
) -> list[dict[str, object]]:
    """Run diarization using a locally stored pyannote pipeline."""
    try:
        from pyannote.audio import Pipeline
    except ImportError:
        logger.error("pyannote.audio ej installerat - kan inte anvanda lokal modell")
        return segments

    if progress_callback:
        progress_callback(72, "Laddar lokal talaridentifieringsmodell...")

    pipeline = Pipeline.from_pretrained(model_path)
    pipeline.to(device)  # type: ignore[no-untyped-call]

    if progress_callback:
        progress_callback(78, "Identifierar talare (lokal modell)...")

    import torch

    with torch.no_grad():
        diarization = pipeline(audio_path)

    # Convert pyannote output to per-segment speaker labels
    if progress_callback:
        progress_callback(85, "Tilldelar talare till segment...")

    # Build a list of (start, end, speaker) tuples from pyannote output
    speaker_turns: list[tuple[float, float, str]] = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        speaker_turns.append((turn.start, turn.end, speaker))

    # Assign speakers to segments based on overlap
    for seg in segments:
        seg_start = float(seg.get("start", 0.0))
        seg_end = float(seg.get("end", 0.0))
        best_speaker = _find_best_speaker(seg_start, seg_end, speaker_turns)
        if best_speaker:
            seg["speaker"] = best_speaker

    if progress_callback:
        progress_callback(90, "Talaridentifiering klar")

    return segments


def _diarize_whisperx(
    audio_path: str,
    segments: list[dict[str, object]],
    hf_token: str,
    device: str,
    progress_callback: Callable[[int, str], None] | None,
) -> list[dict[str, object]]:
    """Run diarization using WhisperX + pyannote via HuggingFace token."""
    import whisperx

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


def _find_best_speaker(
    seg_start: float,
    seg_end: float,
    speaker_turns: list[tuple[float, float, str]],
) -> str | None:
    """Find the speaker with the most overlap for a given segment time range."""
    best_speaker: str | None = None
    best_overlap = 0.0

    for turn_start, turn_end, speaker in speaker_turns:
        overlap_start = max(seg_start, turn_start)
        overlap_end = min(seg_end, turn_end)
        overlap = max(0.0, overlap_end - overlap_start)

        if overlap > best_overlap:
            best_overlap = overlap
            best_speaker = speaker

    return best_speaker
