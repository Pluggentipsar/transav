---
paths:
  - "backend/**/*.py"
---

# Python Backend-regler

## Ramverk och bibliotek
- FastAPI for alla endpoints, Pydantic v2 for schemas
- SQLAlchemy 2.0 async mode med aiosqlite
- Inga synkrona DB-anrop - alltid `async def` + `AsyncSession`

## Kodstil
- Ruff: line-length=100, select = ["E", "F", "I", "UP", "B"]
- Mypy strict mode
- Typ-annotationer pa alla funktioner
- Docstrings pa publika funktioner (svenska ok)

## Projektstruktur
- `app/models/` - SQLAlchemy ORM-modeller (en fil per tabell)
- `app/schemas/` - Pydantic request/response-modeller
- `app/services/` - Affarslogik och ML-integration (ALDRIG i endpoints)
- `app/api/v1/` - REST-endpoints (tunn logik, delegera till services)
- `app/workers/` - Bakgrundsprocessning

## Konventioner
- Alla API-routes returnerar Pydantic-modeller, inte dicts
- Anvand `HTTPException` for felhantering i endpoints
- Bakgrundsprocessning via `concurrent.futures.ThreadPoolExecutor`
- UUIDs for jobb-ID:n, auto-increment for segment/word-ID:n
- Logga med Pythons `logging` modul, inte `print()`

## Databasmigrering
- Lagg till nya kolumner med ALTER TABLE i `database.py` init
- Droppa aldrig kolumner utan att fraga anvandaren forst
