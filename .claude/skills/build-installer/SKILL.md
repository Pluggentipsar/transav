---
name: build-installer
description: Bygg om frontend och uppdatera installer-filerna for TystText
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

Bygg TystText-installern (frontend + installationsscript).

## Steg

1. **Bygg frontend som statisk export:**
   ```bash
   cd frontend && rm -rf .next out && NEXT_PUBLIC_APP_MODE=local npm run build
   ```
   - MASTE ha `NEXT_PUBLIC_APP_MODE=local` for att Next.js ska gora `output: 'export'`
   - Kontrollera att `frontend/out/` skapas

2. **Verifiera att dynamiska routes fungerar:**
   - `frontend/out/jobs/_.html` ska finnas (fallback for /jobs/[id])
   - Om den saknas: `src/app/jobs/[id]/page.tsx` behover `generateStaticParams()` med minst `[{ id: "_" }]`
   - page.tsx maste vara server component (ingen "use client") — klientkoden ligger i `client.tsx`

3. **Kontrollera backend-fallback:**
   - `backend/app/main.py` serverar `jobs/_.html` for alla `/jobs/{id}` requests
   - Maste ligga FORE `app.mount("/", StaticFiles(...))` annars catchas det aldrig

4. **Rapportera:**
   - Frontend-byggets status
   - Antal genererade sidor
   - Storlek pa `frontend/out/`

## Installationsfiler (referens)

| Fil | Syfte |
|-----|-------|
| `installera.bat` | Wrapper: chcp 65001 + anropar installera.ps1 |
| `installera.ps1` | Huvudinstallation: Python embedded, pip, PyTorch, deps, ffmpeg, KB-BERT NER |
| `starta.bat` | Satter PATH/env, kor launcher.py med embedded Python |
| `launcher.py` | Satter env vars (TYSTTEXT_DATA_DIR), laddar .env, startar uvicorn |

## Kanda problem och losningar

### BAT-filer
- ALDRIG anvand non-ASCII-tecken (em-dash, a-ring, o-umlaut) — cmd.exe laserdem som multi-byte skrap
- INGEN UTF-8 BOM — cmd.exe klarar inte det

### PowerShell (installera.ps1)
- MASTE ha UTF-8 BOM — PowerShell 5.1 laser annars som ANSI, korrumperar svenska tecken
- `$ErrorActionPreference = 'Stop'` dodar scriptet nar native exe (pip, python) skriver till stderr
  - Losning: `Invoke-Native` helper som temporart satter `'Continue'`
- Here-strings `@"..."@` med Python-kod: `{len(x)}` tolkas som PS-syntax
  - Losning: anvand string-array och `-join` istallet
- `"$var[extra]"` i dubbelciterade strangar: PS tolkar `[extra]` som array-index
  - Losning: `$spec = $var + '[extra]'` (string concatenation)

### pip + Embedded Python
- `pip install -e` (editable) fungerar INTE med embedded Python
  - Losning: installera beroenden direkt med `pip install fastapi uvicorn ...`
  - `launcher.py` lagger till `backend/` i `sys.path` sa appkoden hittas anda
- Bygg-isolation (`--no-build-isolation`) ocksa problematisk
  - Losning: skippa helt, installera deps manuellt

### Next.js static export
- Dynamiska routes (`/jobs/[id]`) kraver `generateStaticParams()` med minst ett vardeellersa failar bygget
- `generateStaticParams` kan INTE exporteras fran "use client"-filer
  - Losning: page.tsx (server) importerar client.tsx ("use client")
- Backend maste servera fallback-HTML for dynamiska routes
