"""TystText FastAPI application entry point."""

import logging
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db.database import init_db

logger = logging.getLogger(__name__)

# Windows: Fix HuggingFace Hub symlink issues
if sys.platform == "win32":
    import os

    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

# PyTorch 2.6+ compatibility: patch torch.load for pyannote
try:
    import torch

    _original_torch_load = torch.load

    def _patched_torch_load(*args, **kwargs):  # type: ignore[no-untyped-def]
        kwargs.setdefault("weights_only", False)
        return _original_torch_load(*args, **kwargs)

    torch.load = _patched_torch_load  # type: ignore[assignment]
except ImportError:
    pass


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: initialize DB and create directories."""
    # Create required directories
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    settings.models_path.mkdir(parents=True, exist_ok=True)

    # Initialize database
    await init_db()

    logger.info("TystText started successfully")
    yield
    logger.info("TystText shutting down")


app = FastAPI(
    title=settings.app_name,
    description="Lokal svensk transkriptionsapplikation",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for development (frontend on port 3000, backend on 8000)
if settings.debug:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register API routes
from app.api.v1.router import api_router  # noqa: E402

app.include_router(api_router, prefix="/api/v1")


# Health check
@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


# Serve static frontend in production
static_path = settings.static_path
if static_path.exists():
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")
