"""Application configuration using Pydantic Settings."""

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    app_name: str = "TystText"
    debug: bool = False

    # File paths
    upload_dir: str = "../data/uploads"
    models_dir: str = "../data/models"
    database_url: str = "sqlite+aiosqlite:///../data/transcription.db"
    static_dir: str = "../frontend/out"

    # ML settings
    default_engine: str = "faster-whisper"
    default_model: str = "KBLab/kb-whisper-small"
    default_device: str = "auto"
    default_compute_type: str = "auto"
    chunk_length_seconds: int = 30

    # Upload settings
    max_file_size_mb: int = 2000

    # HuggingFace
    hf_token: str = ""

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir).resolve()

    @property
    def models_path(self) -> Path:
        return Path(self.models_dir).resolve()

    @property
    def static_path(self) -> Path:
        return Path(self.static_dir).resolve()

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
