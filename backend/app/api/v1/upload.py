"""File upload endpoints."""

import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from app.config import settings
from app.schemas.upload import UploadResponse

router = APIRouter()

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm"}


@router.post("", response_model=UploadResponse)
async def upload_file(file: UploadFile) -> UploadResponse:
    """Upload an audio file for transcription."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filnamn saknas")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Filtyp {ext} stods inte. Tillåtna: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    file_id = str(uuid.uuid4())
    file_path = settings.upload_path / f"{file_id}{ext}"

    content = await file.read()
    file_size = len(content)

    max_size = settings.max_file_size_mb * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"Filen ar for stor. Max {settings.max_file_size_mb} MB.",
        )

    file_path.write_bytes(content)

    return UploadResponse(
        file_id=file_id,
        file_name=file.filename,
        file_path=str(file_path),
        file_size=file_size,
    )


@router.delete("/{file_id}")
async def delete_upload(file_id: str) -> dict[str, str]:
    """Delete an uploaded file."""
    for ext in ALLOWED_EXTENSIONS:
        path = settings.upload_path / f"{file_id}{ext}"
        if path.exists():
            path.unlink()
            return {"status": "deleted"}

    raise HTTPException(status_code=404, detail="Fil hittades inte")
