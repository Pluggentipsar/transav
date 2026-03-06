---
name: start-dev
description: Starta utvecklingsservrar for TystText (backend + frontend)
disable-model-invocation: true
allowed-tools: Bash
---

Starta utvecklingsmiljon for TystText:

1. Kontrollera att backend-venv finns, annars skapa:
   ```bash
   cd backend && python -m venv .venv && .venv/Scripts/activate && pip install -e ".[dev]"
   ```

2. Kontrollera att frontend node_modules finns, annars installera:
   ```bash
   cd frontend && npm install
   ```

3. Starta backend i bakgrunden:
   ```bash
   cd backend && .venv/Scripts/activate && uvicorn app.main:app --reload --port 8000
   ```

4. Starta frontend i bakgrunden:
   ```bash
   cd frontend && npm run dev
   ```

5. Informera anvandaren att:
   - Backend kors pa http://localhost:8000
   - Frontend kors pa http://localhost:3000
   - API-docs finns pa http://localhost:8000/docs
