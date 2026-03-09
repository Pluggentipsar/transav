"""OCR service: EasyOCR-based text extraction from images and PDFs."""

import logging
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# EasyOCR reader cache (same pattern as _ner_pipeline in anonymization.py)
_ocr_reader: object | None = None


def is_ocr_available() -> bool:
    """Check if EasyOCR is installed."""
    try:
        import easyocr  # noqa: F401

        return True
    except ImportError:
        return False


def is_pdf_available() -> bool:
    """Check if PyMuPDF (fitz) is installed for PDF support."""
    try:
        import fitz  # noqa: F401

        return True
    except ImportError:
        return False


def _get_reader() -> object:
    """Get or create cached EasyOCR reader."""
    global _ocr_reader
    if _ocr_reader is None:
        import os

        import easyocr

        # EasyOCR's download progress bar uses Unicode chars (U+2588 Full Block)
        # that crash on Windows with the default 'charmap' codec.
        os.environ["PYTHONIOENCODING"] = "utf-8"
        _ocr_reader = easyocr.Reader(["sv", "en"], gpu=True, verbose=False)
        logger.info("EasyOCR reader initialized (sv, en)")
    return _ocr_reader


def clear_ocr_cache() -> None:
    """Clear cached OCR reader to free memory."""
    global _ocr_reader
    _ocr_reader = None
    logger.info("OCR reader cache cleared")


@dataclass
class OcrPageResult:
    """OCR result for a single page/image."""

    page_number: int
    text: str
    confidence: float


@dataclass
class OcrResult:
    """Complete OCR result."""

    pages: list[OcrPageResult] = field(default_factory=list)
    full_text: str = ""
    total_pages: int = 0
    average_confidence: float = 0.0


def _extract_text_from_image(image_input: str | object, page_number: int = 1) -> OcrPageResult:
    """Run OCR on a single image (file path or numpy array)."""
    reader = _get_reader()
    results = reader.readtext(image_input)  # type: ignore[union-attr]

    texts = []
    confidences = []
    for _bbox, text, confidence in results:
        texts.append(text)
        confidences.append(confidence)

    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return OcrPageResult(
        page_number=page_number,
        text=" ".join(texts),
        confidence=avg_conf,
    )


def _pdf_to_images(pdf_path: str) -> list[object]:
    """Convert PDF pages to numpy arrays using PyMuPDF."""
    import fitz
    import numpy as np

    doc = fitz.open(pdf_path)
    images = []
    for page in doc:
        pix = page.get_pixmap(dpi=300)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        # EasyOCR expects RGB, convert if RGBA
        if pix.n == 4:
            img = img[:, :, :3]
        images.append(img)
    doc.close()
    return images


def ocr_image(file_path: str) -> OcrResult:
    """Run OCR on a single image file."""
    page_result = _extract_text_from_image(file_path)
    return OcrResult(
        pages=[page_result],
        full_text=page_result.text,
        total_pages=1,
        average_confidence=page_result.confidence,
    )


def ocr_pdf(file_path: str) -> OcrResult:
    """Run OCR on a PDF file (one page at a time)."""
    if not is_pdf_available():
        raise RuntimeError("PyMuPDF ar inte installerat. Installera med: pip install PyMuPDF")

    images = _pdf_to_images(file_path)
    pages: list[OcrPageResult] = []

    for i, img in enumerate(images):
        page_result = _extract_text_from_image(img, page_number=i + 1)
        pages.append(page_result)

    full_text = "\n\n".join(f"--- Sida {p.page_number} ---\n{p.text}" for p in pages)
    avg_conf = sum(p.confidence for p in pages) / len(pages) if pages else 0.0

    return OcrResult(
        pages=pages,
        full_text=full_text,
        total_pages=len(pages),
        average_confidence=avg_conf,
    )


def run_ocr(file_path: str) -> OcrResult:
    """Run OCR on file, auto-detecting image vs PDF."""
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return ocr_pdf(file_path)
    return ocr_image(file_path)
