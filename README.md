# TystText

**Lokal svensk transkriptionsapplikation** — transkribera ljud till text helt på din egen maskin.

TystText omvandlar ljudfiler till text med KBLabs svenska Whisper-modeller. All processning sker lokalt; ingen data lämnar maskinen. Det gör verktyget lämpligt för forskare, journalister och myndigheter som hanterar känsligt material.

## Innehåll

- [Funktioner](#funktioner)
- [Arkitektur](#arkitektur)
- [Installation (Windows)](#installation-windows)
- [Utvecklingsmiljö](#utvecklingsmiljö)
- [Konfiguration](#konfiguration)
- [API](#api)
- [ML-modeller](#ml-modeller)
- [Bygga installern](#bygga-installern)
- [Kända problem](#kända-problem)
- [Projektstruktur](#projektstruktur)

## Funktioner

- **Transkription** av ljud (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.webm`) med KB-Whisper.
- **Talaridentifiering** (diarization) via WhisperX + pyannote.
- **Anonymisering** med KB-BERT NER (PER, LOC, ORG, TME, EVN) kompletterad med regex och egna ordmallar.
- **Ordnivå-redigering** av transkriptet med tillhörande ljudklippning via FFmpeg.
- **OCR** — textextraktion ur bilder och PDF:er (EasyOCR + PyMuPDF), med samma anonymiseringspipeline.
- **Export** i flera format: JSON, PDF, SRT, VTT och ren text.
- **Ljudinspelning** direkt i webbläsaren.

## Arkitektur

```
Backend:  Python 3.11+ / FastAPI / SQLAlchemy 2.0 (async) / aiosqlite / SQLite
Frontend: Next.js 14 / React 18 / TypeScript / TailwindCSS / TanStack Query
ML:       faster-whisper (KB-Whisper) / WhisperX + pyannote / KB-BERT NER / EasyOCR
```

Frontend byggs som statisk export (`out/`) och serveras av FastAPI-backenden, så att hela applikationen körs från en enda lokal process. I utvecklingsläge körs frontend och backend separat med CORS aktiverat.

## Installation (Windows)

TystText distribueras som ett självständigt Windows-program med inbäddad Python och FFmpeg — ingen förinstallerad utvecklingsmiljö krävs.

### Alternativ A: Installationsprogram

1. Kör `TystText-Setup-<version>.exe`.
2. Programmet installeras i `Program Files` (kräver inga administratörsrättigheter).
3. Markera vid behov tillvalet **NVIDIA CUDA 12** för GPU-acceleration (~2,5 GB).
4. Starta via skrivbordsgenvägen eller **Start TystText**.

### Alternativ B: Skriptbaserad installation

Kör installationsskriptet som laddar ner runtime (Python + FFmpeg) och beroenden:

```powershell
.\installera.bat
```

Starta sedan applikationen:

```powershell
.\starta.bat
```

`starta.bat` sätter upp PATH och miljövariabler, kör `launcher.py` (Uvicorn på `127.0.0.1:8080`) och öppnar webbläsaren automatiskt.

## Utvecklingsmiljö

### Backend

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate   # Windows
# källa .venv/bin/activate                         # Linux/macOS
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

pytest                # kör tester
ruff check app/       # lint
mypy app/             # typkontroll
```

Tillvalsberoenden installeras per funktion:

```bash
pip install -e ".[diarization]"     # WhisperX + pyannote
pip install -e ".[anonymization]"   # transformers + torch (KB-BERT)
pip install -e ".[ocr]"             # easyocr + PyMuPDF
pip install -e ".[easytranscriber]" # alternativ transkriptionsmotor
```

### Frontend

```bash
cd frontend
npm install
npm run dev           # dev-server på port 3000
npm run lint          # ESLint
npm run typecheck     # TypeScript-kontroll
npm run build         # statisk export till out/
```

I utvecklingsläge proxas `/api/*` från port 3000 till backenden på port 8000.

## Konfiguration

Backenden konfigureras via miljövariabler eller en `.env`-fil. Kopiera exemplet:

```bash
cd backend
cp .env.example .env
```

| Variabel | Standard | Beskrivning |
|----------|----------|-------------|
| `DEBUG` | `false` | Aktiverar CORS för dev och felsökningsläge |
| `UPLOAD_DIR` | `../data/uploads` | Katalog för uppladdade filer |
| `MODELS_DIR` | `../data/models` | Cache för nedladdade modeller |
| `DATABASE_URL` | `sqlite+aiosqlite:///../data/transcription.db` | SQLite-databas (async) |
| `DEFAULT_MODEL` | `KBLab/kb-whisper-small` | Standardmodell för transkription |
| `DEFAULT_DEVICE` | `auto` | `auto`, `cpu` eller `cuda` |
| `DEFAULT_COMPUTE_TYPE` | `auto` | Beräkningstyp för faster-whisper |
| `HF_TOKEN` | _(tom)_ | HuggingFace-token (krävs för diarization) |
| `MAX_FILE_SIZE_MB` | `2000` | Maximal filstorlek vid uppladdning |
| `CHUNK_LENGTH_SECONDS` | `30` | Segmentlängd vid transkription |

## API

Alla endpoints ligger under `/api/v1/`. Interaktiv dokumentation finns på `/docs` när backenden körs.

| Område | Prefix | Beskrivning |
|--------|--------|-------------|
| Upload | `/upload` | Uppladdning av ljudfiler med formatvalidering |
| Jobb | `/jobs` | CRUD för transkriptionsjobb, transkript och analys |
| Export | `/jobs/{id}/export` | Export i JSON, PDF, SRT, VTT, text |
| Editor | `/editor/{id}` | Ordnivå-redigering och ljudexport |
| Anonymisering | `/anonymize` | KB-BERT NER + regex + egna ordmallar |
| OCR | `/ocr` | Text ur bilder och PDF |
| Modeller | `/models` | Lista tillgängliga modeller och systeminfo |
| Inställningar | `/settings` | Hantering av HuggingFace-token |
| Mallar | `/templates` | CRUD för ordersättningsmallar |

### Databas

SQLite via aiosqlite med tabellerna `jobs`, `segments`, `words` och `word_templates`. All databasaccess är asynkron (`AsyncSession`). Tabeller skapas automatiskt vid uppstart, med lättviktiga migreringar för nya kolumner.

## ML-modeller

- **KB-Whisper** — `KBLab/kb-whisper-{tiny|base|small|medium|large}` via faster-whisper.
- **Diarization** — WhisperX + pyannote (kräver en HuggingFace-token).
- **NER** — KB-BERT för svenska entiteter (PER, LOC, ORG, TME, EVN).
- **OCR** — EasyOCR för bilder, PyMuPDF för PDF.

Modeller laddas ner vid första användning och cachas i `MODELS_DIR`.

## Bygga installern

Att bygga Windows-installern kräver [Inno Setup 6](https://jrsoftware.org/isinfo.php).

```powershell
# Bygg frontend och paketera allt till TystText-Setup-<version>.exe
.\build-installer.ps1

# Återanvänd befintlig runtime utan ombyggnad
.\build-installer.ps1 -SkipBuild
```

Skriptet bygger frontend (statisk export), säkerställer att runtime finns och kör `installer.iss` som paketerar backend, förbyggd frontend och startskript till en enda körbar installationsfil.

## Kända problem

1. **PyTorch 2.6+** ändrade standardvärdet för `weights_only` i `torch.load()`, vilket bryter pyannote. Detta monkey-patchas i `main.py`.
2. **Windows-symlinks** — HuggingFace Hub faller tillbaka på kopiering i stället för symlink.
3. **CORS** behövs endast i utvecklingsläge (port 3000 → 8000). I produktion serveras allt från samma port.
4. **FFmpeg** krävs för ljudredigering. WinGet-installationssökväg detekteras på Windows.
5. **Next.js static export** — dynamiska rutter (`/jobs/[id]`) kräver manuell ruttmappning i backenden.
6. **Progressrapportering** sker via `queue.Queue` mellan bakgrundstråd och den asynkrona huvudtråden.

## Projektstruktur

```
transav/
├── backend/                  # Python FastAPI-backend
│   ├── app/
│   │   ├── main.py           # Applikationens entrypoint
│   │   ├── config.py         # Inställningar (Pydantic)
│   │   ├── api/v1/           # REST-endpoints
│   │   ├── db/               # Async SQLAlchemy + aiosqlite
│   │   ├── models/           # ORM-tabeller
│   │   ├── schemas/          # Pydantic-scheman
│   │   ├── services/         # Affärslogik och ML-integration
│   │   └── workers/          # Bakgrundsprocessning
│   ├── tests/
│   └── pyproject.toml
├── frontend/                 # Next.js/React-frontend
│   ├── src/
│   │   ├── app/              # App Router-sidor
│   │   ├── components/       # UI-komponenter
│   │   ├── hooks/            # React-hooks
│   │   ├── services/api.ts   # Axios-klient
│   │   └── types/            # TypeScript-typer
│   └── package.json
├── launcher.py               # Plattformsoberoende start
├── starta.bat                # Windows-startpunkt
├── installera.ps1            # Laddar ner runtime + beroenden
├── build-installer.ps1       # Bygger .exe via Inno Setup
└── installer.iss             # Inno Setup-konfiguration
```

## Licens

Ingen licens har angetts för projektet ännu.
```
