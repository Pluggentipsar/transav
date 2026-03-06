"""CRUD endpoints for word replacement templates."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.models.template import WordTemplate

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Request/Response schemas ---


class WordReplacement(BaseModel):
    """A single word replacement rule."""

    original: str
    replacement: str


class TemplateCreate(BaseModel):
    """Request to create a template."""

    name: str
    description: str | None = None
    words: list[WordReplacement] = []


class TemplateUpdate(BaseModel):
    """Request to update a template."""

    name: str | None = None
    description: str | None = None
    words: list[WordReplacement] | None = None


class TemplateResponse(BaseModel):
    """Template response."""

    id: str
    name: str
    description: str | None
    words: list[WordReplacement]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateListResponse(BaseModel):
    """List of templates."""

    templates: list[TemplateResponse]
    total: int


# --- Helpers ---


def _words_to_json(words: list[WordReplacement]) -> str:
    """Serialize word replacements to JSON string."""
    return json.dumps(
        [{"original": w.original, "replacement": w.replacement} for w in words],
        ensure_ascii=False,
    )


def _json_to_words(words_json: str) -> list[WordReplacement]:
    """Deserialize word replacements from JSON string."""
    try:
        data = json.loads(words_json)
        return [WordReplacement(**item) for item in data]
    except (json.JSONDecodeError, TypeError):
        return []


def _template_to_response(template: WordTemplate) -> TemplateResponse:
    """Convert a WordTemplate model to a TemplateResponse."""
    return TemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        words=_json_to_words(template.words_json),
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


# --- Endpoints ---


@router.get("", response_model=TemplateListResponse)
async def list_templates(
    session: AsyncSession = Depends(get_session),
) -> TemplateListResponse:
    """List all word replacement templates."""
    result = await session.execute(
        select(WordTemplate).order_by(WordTemplate.created_at.desc())
    )
    templates = list(result.scalars().all())

    return TemplateListResponse(
        templates=[_template_to_response(t) for t in templates],
        total=len(templates),
    )


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(
    data: TemplateCreate,
    session: AsyncSession = Depends(get_session),
) -> TemplateResponse:
    """Create a new word replacement template."""
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Mallnamn far inte vara tomt")

    template = WordTemplate(
        name=data.name.strip(),
        description=data.description,
        words_json=_words_to_json(data.words),
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)

    logger.info("Created template '%s' with %d words", template.name, len(data.words))
    return _template_to_response(template)


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    data: TemplateUpdate,
    session: AsyncSession = Depends(get_session),
) -> TemplateResponse:
    """Update a word replacement template."""
    result = await session.execute(
        select(WordTemplate).where(WordTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Mall hittades inte")

    if data.name is not None:
        if not data.name.strip():
            raise HTTPException(status_code=400, detail="Mallnamn far inte vara tomt")
        template.name = data.name.strip()

    if data.description is not None:
        template.description = data.description

    if data.words is not None:
        template.words_json = _words_to_json(data.words)

    template.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(template)

    logger.info("Updated template '%s'", template.name)
    return _template_to_response(template)


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Delete a word replacement template."""
    result = await session.execute(
        select(WordTemplate).where(WordTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Mall hittades inte")

    await session.delete(template)
    await session.commit()

    logger.info("Deleted template '%s'", template.name)
    return {"status": "deleted"}
