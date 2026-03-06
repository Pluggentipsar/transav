---
name: new-endpoint
description: Skapa en ny API-endpoint i backend enligt projektets monster
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep
argument-hint: "[endpoint-namn] [beskrivning]"
---

Skapa en ny API-endpoint for TystText backend. Foljande argument ges:
- Endpoint-namn och beskrivning: $ARGUMENTS

Steg:

1. Las befintliga endpoints i `backend/app/api/v1/` for att forsta monstret

2. Skapa Pydantic-schemas i `backend/app/schemas/` om det behovs
   - Request-modell och Response-modell
   - Folj befintliga konventioner

3. Skapa endpoint-fil i `backend/app/api/v1/`
   - Anvand FastAPI APIRouter
   - Returnera Pydantic-modeller
   - Anvand HTTPException for fel
   - Async def for alla handlers

4. Registrera routern i `backend/app/api/v1/router.py`

5. Om affarslogik behovs, lagg den i `backend/app/services/`
   - Tunn endpoint, tjock service

6. Sammanfatta vad som skapades och hur det kan testas
