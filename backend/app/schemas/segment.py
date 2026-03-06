"""Pydantic schemas for segments and transcripts."""

from pydantic import BaseModel


class WordResponse(BaseModel):
    id: int
    word_index: int
    start_time: float
    end_time: float
    text: str
    confidence: float | None
    included: bool

    model_config = {"from_attributes": True}


class SegmentResponse(BaseModel):
    id: int
    segment_index: int
    start_time: float
    end_time: float
    text: str
    anonymized_text: str | None
    speaker: str | None
    confidence: float | None

    model_config = {"from_attributes": True}


class SegmentUpdate(BaseModel):
    text: str | None = None
    anonymized_text: str | None = None
    speaker: str | None = None


class TranscriptResponse(BaseModel):
    job_id: str
    segments: list[SegmentResponse]
    total_segments: int


class SpeakerRenameRequest(BaseModel):
    old_name: str
    new_name: str
