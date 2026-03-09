"""Settings endpoints for HuggingFace token management."""

import logging
import os
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Path to .env file — prefer TYSTTEXT_DATA_DIR if set, else backend root
_ENV_FILE = (
    Path(os.environ["TYSTTEXT_DATA_DIR"]) / ".env"
    if os.environ.get("TYSTTEXT_DATA_DIR")
    else Path(__file__).resolve().parents[3] / ".env"
)


# --- Request/Response schemas ---


class HfTokenStatus(BaseModel):
    """HuggingFace token status."""

    is_set: bool
    token_preview: str | None


class HfTokenSetRequest(BaseModel):
    """Request to set HuggingFace token."""

    token: str


class HfTokenSetResponse(BaseModel):
    """Response after setting token."""

    message: str
    is_set: bool


class HfTokenDeleteResponse(BaseModel):
    """Response after deleting token."""

    message: str
    is_set: bool


# --- Helper functions ---


def _read_env_file() -> str:
    """Read the .env file contents, or empty string if it does not exist."""
    if _ENV_FILE.exists():
        return _ENV_FILE.read_text(encoding="utf-8")
    return ""


def _write_env_file(content: str) -> None:
    """Write content to .env file, creating it if necessary."""
    _ENV_FILE.write_text(content, encoding="utf-8")


def _get_hf_token() -> str | None:
    """Read HF_TOKEN from the .env file."""
    content = _read_env_file()
    match = re.search(r'^HF_TOKEN\s*=\s*["\']?([^"\'#\n]+)["\']?', content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return None


def _set_hf_token(token: str) -> None:
    """Set or update HF_TOKEN in the .env file."""
    content = _read_env_file()

    new_line = f'HF_TOKEN="{token}"'

    if re.search(r'^HF_TOKEN\s*=', content, re.MULTILINE):
        # Replace existing token
        content = re.sub(
            r'^HF_TOKEN\s*=.*$',
            new_line,
            content,
            flags=re.MULTILINE,
        )
    else:
        # Append token
        if content and not content.endswith("\n"):
            content += "\n"
        content += new_line + "\n"

    _write_env_file(content)

    # Also update the running settings
    from app.config import settings

    settings.hf_token = token


def _remove_hf_token() -> None:
    """Remove HF_TOKEN from the .env file."""
    content = _read_env_file()

    content = re.sub(r'^HF_TOKEN\s*=.*\n?', "", content, flags=re.MULTILINE)
    _write_env_file(content)

    # Clear from running settings
    from app.config import settings

    settings.hf_token = ""


# --- Endpoints ---


@router.get("/hf-token", response_model=HfTokenStatus)
async def get_hf_token_status() -> HfTokenStatus:
    """Check if HuggingFace token is set."""
    token = _get_hf_token()
    if token:
        # Show only first 8 and last 4 characters
        if len(token) > 12:
            preview = f"{token[:8]}...{token[-4:]}"
        else:
            preview = token[:4] + "..."
        return HfTokenStatus(is_set=True, token_preview=preview)

    return HfTokenStatus(is_set=False, token_preview=None)


@router.post("/hf-token", response_model=HfTokenSetResponse)
async def set_hf_token(data: HfTokenSetRequest) -> HfTokenSetResponse:
    """Save HuggingFace token to .env file."""
    token = data.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token far inte vara tom")

    if not token.startswith("hf_"):
        raise HTTPException(
            status_code=400,
            detail="Ogiltig token. HuggingFace-tokens borjar med 'hf_'",
        )

    try:
        _set_hf_token(token)
        logger.info("HuggingFace token saved successfully")
        return HfTokenSetResponse(
            message="HuggingFace-token sparad",
            is_set=True,
        )
    except Exception as e:
        logger.exception("Failed to save HF token")
        raise HTTPException(
            status_code=500,
            detail=f"Kunde inte spara token: {e}",
        ) from e


@router.delete("/hf-token", response_model=HfTokenDeleteResponse)
async def delete_hf_token() -> HfTokenDeleteResponse:
    """Remove HuggingFace token from .env file."""
    try:
        _remove_hf_token()
        logger.info("HuggingFace token removed")
        return HfTokenDeleteResponse(
            message="HuggingFace-token borttagen",
            is_set=False,
        )
    except Exception as e:
        logger.exception("Failed to remove HF token")
        raise HTTPException(
            status_code=500,
            detail=f"Kunde inte ta bort token: {e}",
        ) from e
