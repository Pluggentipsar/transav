"""Pydantic schemas for transcription jobs."""

from datetime import datetime

from pydantic import BaseModel


class JobCreate(BaseModel):
    file_path: str
    name: str | None = None
    engine: str = "faster-whisper"
    model: str = "KBLab/kb-whisper-small"
    language: str = "sv"
    enable_diarization: bool = False
    enable_anonymization: bool = False
    ner_entity_types: str | None = None
    anonymize_template_id: str | None = None


class JobUpdate(BaseModel):
    name: str | None = None


class JobResponse(BaseModel):
    id: str
    name: str
    file_name: str
    file_size: int
    duration_seconds: float | None
    engine: str
    model: str
    language: str
    enable_diarization: bool
    enable_anonymization: bool
    anonymize_template_id: str | None
    status: str
    progress: int
    current_step: str | None
    error_message: str | None
    speaker_count: int
    word_count: int
    segment_count: int
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int
