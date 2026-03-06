"""Pydantic schemas for file uploads."""

from pydantic import BaseModel


class UploadResponse(BaseModel):
    file_id: str
    file_name: str
    file_path: str
    file_size: int
