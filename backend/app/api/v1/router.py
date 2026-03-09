"""Aggregated API v1 router."""

from fastapi import APIRouter

from app.api.v1 import (
    anonymize,
    editor,
    export,
    jobs,
    models,
    ocr,
    settings,
    templates,
    upload,
)

api_router = APIRouter()

api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(export.router, tags=["export"])
api_router.include_router(editor.router, prefix="/editor", tags=["editor"])
api_router.include_router(anonymize.router, tags=["anonymize"])
api_router.include_router(ocr.router, prefix="/ocr", tags=["ocr"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
