"""Async SQLAlchemy database setup with aiosqlite."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.base import Base

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    """Dependency for FastAPI endpoints."""
    async with async_session() as session:
        yield session


async def init_db() -> None:
    """Create all tables on startup and run lightweight migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Lightweight column migrations for existing databases
    async with engine.begin() as conn:
        await _migrate_add_column(conn, "jobs", "engine", "TEXT DEFAULT 'faster-whisper'")
        await _migrate_add_column(conn, "jobs", "anonymize_template_id", "VARCHAR(36)")


async def _migrate_add_column(
    conn: "AsyncConnection",  # noqa: F821
    table: str,
    column: str,
    col_type: str,
) -> None:
    """Add a column to an existing table if it doesn't exist yet."""
    from sqlalchemy import text

    result = await conn.execute(text(f"PRAGMA table_info({table})"))
    columns = [row[1] for row in result.fetchall()]
    if column not in columns:
        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
        import logging

        logging.getLogger(__name__).info("Added column %s.%s", table, column)
