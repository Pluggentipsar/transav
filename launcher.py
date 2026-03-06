"""TystText launcher - starts the app and opens browser."""

import os
import sys
import time
import threading
import webbrowser
from pathlib import Path


def main() -> None:
    """Launch TystText application."""
    # Determine data directory
    if getattr(sys, "frozen", False):
        # Running as PyInstaller bundle
        base_dir = Path(sys.executable).parent
    else:
        base_dir = Path(__file__).parent

    data_dir = base_dir / "data"
    data_dir.mkdir(exist_ok=True)
    (data_dir / "uploads").mkdir(exist_ok=True)
    (data_dir / "models").mkdir(exist_ok=True)

    # Set environment variables
    os.environ.setdefault("UPLOAD_DIR", str(data_dir / "uploads"))
    os.environ.setdefault("MODELS_DIR", str(data_dir / "models"))
    os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{data_dir / 'transcription.db'}")

    # Load .env if exists
    env_file = data_dir / ".env"
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)

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
