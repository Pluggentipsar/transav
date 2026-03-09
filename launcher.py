"""TystText launcher - starts the app and opens browser."""

import os
import sys
import time
import threading
import webbrowser
from pathlib import Path


def main() -> None:
    """Launch TystText application."""
    # Determine base directory
    if getattr(sys, "frozen", False):
        base_dir = Path(sys.executable).parent
    else:
        base_dir = Path(__file__).parent

    # Data directory: TYSTTEXT_DATA_DIR (set by starta.bat) > default
    data_dir = Path(os.environ.get("TYSTTEXT_DATA_DIR", "")) if os.environ.get("TYSTTEXT_DATA_DIR") else base_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "uploads").mkdir(exist_ok=True)
    (data_dir / "models").mkdir(exist_ok=True)

    # Set environment variables — setdefault so starta.bat can override
    os.environ.setdefault("UPLOAD_DIR", str(data_dir / "uploads"))
    os.environ.setdefault("MODELS_DIR", str(data_dir / "models"))
    os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{data_dir / 'transcription.db'}")
    os.environ.setdefault("STATIC_DIR", str(base_dir / "frontend" / "out"))
    os.environ.setdefault("HF_HOME", str(data_dir / "models" / "huggingface"))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(data_dir / "models" / "huggingface"))

    # Load .env — check data_dir first, then project root
    try:
        from dotenv import load_dotenv
        env_data = data_dir / ".env"
        env_root = base_dir / ".env"
        if env_data.exists():
            load_dotenv(env_data)
        if env_root.exists() and env_root != env_data:
            load_dotenv(env_root, override=False)
    except ImportError:
        pass

    port = 8080
    host = "127.0.0.1"

    print(f"\n  TystText startar pa http://{host}:{port}")
    print("  Tryck Ctrl+C for att avsluta\n")

    # Open browser after short delay
    def open_browser() -> None:
        time.sleep(2)
        webbrowser.open(f"http://{host}:{port}")

    threading.Thread(target=open_browser, daemon=True).start()

    # Start server
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    # Add backend to path
    backend_dir = Path(__file__).parent / "backend"
    if backend_dir.exists():
        sys.path.insert(0, str(backend_dir))
    main()
