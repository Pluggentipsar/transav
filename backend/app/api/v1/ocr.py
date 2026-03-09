"""OCR endpoints for text extraction from images and PDFs."""

import asyncio
import json
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.services.ocr import is_ocr_available, is_pdf_available, run_ocr

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}
ALLOWED_PDF_EXTENSIONS = {".pdf"}
ALLOWED_OCR_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_PDF_EXTENSIONS


# --- Request/Response schemas ---


class OcrPageResponse(BaseModel):
    """OCR result for a single page."""

    page_number: int
    text: str
    confidence: float


class OcrResponse(BaseModel):
    """Response from OCR processing."""

    file_name: str
    full_text: str
    pages: list[OcrPageResponse]
    total_pages: int
    average_confidence: float


class OcrStatusResponse(BaseModel):
    """OCR availability status."""

    ocr_available: bool
    pdf_available: bool
    supported_languages: list[str]
    supported_formats: list[str]


class OcrAnonymizeResponse(BaseModel):
    """Response from OCR + anonymization."""

    file_name: str
    original_text: str
    anonymized_text: str
    total_pages: int
    entities_found: int
    entity_counts: dict[str, int] = {}


# --- Endpoints ---


@router.post("", response_model=OcrResponse)
async def extract_text(file: UploadFile) -> OcrResponse:
    """Upload an image or PDF and extract text via OCR."""
    if not is_ocr_available():
        raise HTTPException(
            status_code=503,
            detail="EasyOCR ar inte installerat. Installera med: pip install easyocr",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filnamn saknas")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_OCR_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Filtyp {ext} stods inte. "
                f"Tillatna: {', '.join(sorted(ALLOWED_OCR_EXTENSIONS))}"
            ),
        )

    if ext in ALLOWED_PDF_EXTENSIONS and not is_pdf_available():
        raise HTTPException(
            status_code=503,
            detail="PDF-stod kraver PyMuPDF. Installera med: pip install PyMuPDF",
        )

    # Save file temporarily
    file_id = str(uuid.uuid4())
    file_path = settings.upload_path / f"{file_id}{ext}"

    content = await file.read()
    file_size = len(content)

    max_size = 50 * 1024 * 1024  # 50 MB
    if file_size > max_size:
        raise HTTPException(status_code=413, detail="Filen ar for stor. Max 50 MB for OCR.")

    file_path.write_bytes(content)

    try:
        result = await asyncio.to_thread(run_ocr, str(file_path))

        return OcrResponse(
            file_name=file.filename,
            full_text=result.full_text,
            pages=[
                OcrPageResponse(
                    page_number=p.page_number,
                    text=p.text,
                    confidence=p.confidence,
                )
                for p in result.pages
            ],
            total_pages=result.total_pages,
            average_confidence=result.average_confidence,
        )
    except Exception as e:
        logger.error("OCR failed for %s: %s", file.filename, e)
        raise HTTPException(status_code=500, detail=f"OCR misslyckades: {e}") from e
    finally:
        if file_path.exists():
            file_path.unlink()


@router.post("/anonymize", response_model=OcrAnonymizeResponse)
async def extract_and_anonymize(
    file: UploadFile,
    use_ner: bool = Form(True),
    use_patterns: bool = Form(True),
    entity_types: str | None = Form(None),
    pattern_types: str | None = Form(None),
) -> OcrAnonymizeResponse:
    """Upload an image/PDF, extract text, then anonymize the result."""
    from app.services.anonymization import anonymize_ner, anonymize_patterns, is_ner_available

    if not is_ocr_available():
        raise HTTPException(status_code=503, detail="EasyOCR ar inte installerat.")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filnamn saknas")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_OCR_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Filtyp {ext} stods inte.")

    # Parse JSON-encoded lists
    parsed_entity_types: list[str] | None = None
    parsed_pattern_types: list[str] | None = None
    if entity_types:
        try:
            parsed_entity_types = json.loads(entity_types)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Ogiltigt format for entity_types")
    if pattern_types:
        try:
            parsed_pattern_types = json.loads(pattern_types)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Ogiltigt format for pattern_types")

    file_id = str(uuid.uuid4())
    file_path = settings.upload_path / f"{file_id}{ext}"
    content = await file.read()
    file_path.write_bytes(content)

    try:
        ocr_result = await asyncio.to_thread(run_ocr, str(file_path))
        original_text = ocr_result.full_text

        anonymized = original_text
        total_entities = 0
        merged_counts: dict[str, int] = {}

        if use_ner and is_ner_available():
            ner_result = await asyncio.to_thread(
                anonymize_ner, anonymized, entity_types=parsed_entity_types
            )
            anonymized = ner_result.text
            total_entities += ner_result.entities_found
            if ner_result.entity_counts:
                for k, v in ner_result.entity_counts.items():
                    merged_counts[k] = merged_counts.get(k, 0) + v

        if use_patterns:
            pattern_result = anonymize_patterns(anonymized, pattern_types=parsed_pattern_types)
            anonymized = pattern_result.text
            total_entities += pattern_result.entities_found
            if pattern_result.entity_counts:
                for k, v in pattern_result.entity_counts.items():
                    merged_counts[k] = merged_counts.get(k, 0) + v

        return OcrAnonymizeResponse(
            file_name=file.filename,
            original_text=original_text,
            anonymized_text=anonymized,
            total_pages=ocr_result.total_pages,
            entities_found=total_entities,
            entity_counts=merged_counts,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("OCR+anonymize failed: %s", e)
        raise HTTPException(status_code=500, detail=f"OCR misslyckades: {e}") from e
    finally:
        if file_path.exists():
            file_path.unlink()


@router.get("/status", response_model=OcrStatusResponse)
async def ocr_status() -> OcrStatusResponse:
    """Check OCR availability and supported formats."""
    return OcrStatusResponse(
        ocr_available=is_ocr_available(),
        pdf_available=is_pdf_available(),
        supported_languages=["sv", "en"],
        supported_formats=sorted(ALLOWED_OCR_EXTENSIONS),
    )
