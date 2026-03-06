# TystText - Lokal svensk transkriptionsapplikation

## Projektbeskrivning

TystText transkriberar ljudfiler till text med KBLabs svenska Whisper-modeller. All processning sker lokalt - ingen data lamnar maskinen. Funktioner: transkription, talaridentifiering (WhisperX/pyannote), anonymisering (KB-BERT NER + regex), ordniva-ljudredigering, och export i flera format.

**Malgrupp:** Forskare, journalister, myndigheter som hanterar kansligt material.

## Arkitektur

```
Backend:  Python 3.11+ / FastAPI / SQLAlchemy 2.0 (async) / aiosqlite / SQLite
Frontend: Next.js 14 / React 18 / TypeScript / TailwindCSS / TanStack Query
ML:       faster-whisper (KB-Whisper) / WhisperX+pyannote / KB-BERT NER
```

## Kommandon

### Backend
```bash
cd backend
python -m venv .venv && .venv/Scripts/activate  # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
pytest                    # kor tester
ruff check app/           # lint
mypy app/                 # typkontroll
```

### Frontend
```bash
cd frontend
npm install
npm run dev               # dev-server pa port 3000
npm run lint              # ESLint
npm run typecheck         # TypeScript-kontroll
npm run build             # statisk export (out/)
```

## Kodstandard

- **Python:** Ruff (line-length=100), mypy strict, async/await genomgaende for DB
- **TypeScript:** ESLint + strict TypeScript, inga `any`-typer
- **Namngivning:** Svenska for UI-texter/kommentarer, engelska for kod (variabelnamn, funktioner, klasser)
- **Importer:** Absoluta importer i frontend (`@/components/...`), relativa i backend
- **Felhantering:** Aldrig tysta `except:`/`catch` - logga alltid fel
- **Tester:** pytest + pytest-asyncio (backend), inga tester i frontend an

## API-struktur

Alla endpoints under `/api/v1/`. Se @backend/app/api/v1/router.py for komplett routing.

| Omrade | Prefix | Fil |
|--------|--------|-----|
| Upload | `/upload` | `upload.py` |
| Jobb | `/jobs` | `jobs.py` |
| Export | `/jobs/{id}/export` | `export.py` |
| Editor | `/editor/{id}` | `editor.py` |
| Anonymisering | `/anonymize` | `anonymize.py` |
| Modeller | `/models` | `models.py` |
| Installningar | `/settings` | `settings.py` |
| Mallar | `/templates` | `templates.py` |

## Databas

SQLite via aiosqlite. Tabeller: `jobs`, `segments`, `words`, `word_templates`.
VIKTIGT: Anvand alltid `AsyncSession` och `async with` for DB-operationer. Blanda ALDRIG synkron och asynkron databasaccess.

## ML-modeller

- **KB-Whisper:** `KBLab/kb-whisper-{tiny|base|small|medium|large}` via faster-whisper
- **Diarization:** WhisperX + pyannote (kraver HuggingFace-token)
- **NER:** KB-BERT for svenska entiteter (PER, LOC, ORG, TME, EVN)
- Modeller cachas - anvand `clear_model_cache()` for att frigora GPU-minne

## Kanda problem

1. **PyTorch 2.6+**: `torch.load()` andrade default for `weights_only=True` - bryter pyannote. Monkey-patcha i main.py.
2. **Windows symlinks**: HuggingFace Hub fallback till copy istallet for symlink.
3. **CORS**: Behov bara i dev (port 3000 → 8000). I produktion servas allt fran samma port.
4. **ffmpeg**: Kravs for ljudredigering. Detektera WinGet-installationssokvag pa Windows.
5. **Next.js static export**: Dynamiska routes (`/jobs/[id]`) kraver manuell ruttmappning i backend.
6. **Progressrapportering**: Anvand `queue.Queue` for kommunikation fran bakgrundstrad till async-huvudtrad.
