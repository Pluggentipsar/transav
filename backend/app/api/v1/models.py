"""Model listing and system info endpoints."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Response schemas ---


class ModelInfo(BaseModel):
    """Information about an available KB-Whisper model."""

    id: str
    name: str
    size_label: str
    parameters: str
    description: str
    recommended_vram: str


class ModelListResponse(BaseModel):
    """List of available models."""

    models: list[ModelInfo]
    default_model: str


class SystemInfoResponse(BaseModel):
    """System GPU and compute info."""

    cuda_available: bool
    gpu_name: str | None
    gpu_memory_mb: int | None
    device: str
    compute_type: str
    recommended_model: str
    torch_version: str | None


# --- Available KB-Whisper models ---

KB_WHISPER_MODELS: list[ModelInfo] = [
    ModelInfo(
        id="KBLab/kb-whisper-tiny",
        name="KB-Whisper Tiny",
        size_label="tiny",
        parameters="39M",
        description="Snabbast, lagre precision. Bra for testning.",
        recommended_vram="~1 GB",
    ),
    ModelInfo(
        id="KBLab/kb-whisper-base",
        name="KB-Whisper Base",
        size_label="base",
        parameters="74M",
        description="Snabb med rimlig precision.",
        recommended_vram="~1 GB",
    ),
    ModelInfo(
        id="KBLab/kb-whisper-small",
        name="KB-Whisper Small",
        size_label="small",
        parameters="244M",
        description="Bra balans mellan hastighet och precision. Rekommenderad.",
        recommended_vram="~2 GB",
    ),
    ModelInfo(
        id="KBLab/kb-whisper-medium",
        name="KB-Whisper Medium",
        size_label="medium",
        parameters="769M",
        description="Hog precision, kraver mer minne.",
        recommended_vram="~5 GB",
    ),
    ModelInfo(
        id="KBLab/kb-whisper-large",
        name="KB-Whisper Large",
        size_label="large",
        parameters="1550M",
        description="Hogst precision. Kraver GPU med mycket minne.",
        recommended_vram="~10 GB",
    ),
]


# --- Endpoints ---


@router.get("", response_model=ModelListResponse)
async def list_models() -> ModelListResponse:
    """List available KB-Whisper models with sizes."""
    from app.config import settings

    return ModelListResponse(
        models=KB_WHISPER_MODELS,
        default_model=settings.default_model,
    )


@router.get("/system", response_model=SystemInfoResponse)
async def system_info() -> SystemInfoResponse:
    """GPU detection, CUDA status, recommended settings."""
    cuda_available = False
    gpu_name: str | None = None
    gpu_memory_mb: int | None = None
    torch_version: str | None = None

    try:
        import torch

        torch_version = torch.__version__
        cuda_available = torch.cuda.is_available()

        if cuda_available:
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory_mb = int(torch.cuda.get_device_properties(0).total_mem / (1024 * 1024))
    except ImportError:
        pass

    # Determine device and compute type
    device = "cuda" if cuda_available else "cpu"
    compute_type = "float16" if cuda_available else "int8"

    # Recommend model based on GPU memory
    if gpu_memory_mb and gpu_memory_mb >= 8000:
        recommended_model = "KBLab/kb-whisper-large"
    elif gpu_memory_mb and gpu_memory_mb >= 4000:
        recommended_model = "KBLab/kb-whisper-medium"
    elif cuda_available:
        recommended_model = "KBLab/kb-whisper-small"
    else:
        recommended_model = "KBLab/kb-whisper-small"

    return SystemInfoResponse(
        cuda_available=cuda_available,
        gpu_name=gpu_name,
        gpu_memory_mb=gpu_memory_mb,
        device=device,
        compute_type=compute_type,
        recommended_model=recommended_model,
        torch_version=torch_version,
    )
