---
name: new-component
description: Skapa en ny React-komponent i frontend enligt projektets monster
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep
argument-hint: "[komponent-namn] [beskrivning]"
---

Skapa en ny React-komponent for TystText frontend. Foljande argument ges:
- Komponentnamn och beskrivning: $ARGUMENTS

Steg:

1. Las befintliga komponenter i `frontend/src/components/` for att forsta monstret

2. Bestam ratt underkatalog baserat pa funktionalitet:
   - `layout/` - Navigering, headers
   - `upload/` - Uppladdningsrelaterat
   - `transcription/` - Transkriptionsvisning
   - `editor/` - Ljudredigering
   - `ui/` - Generella UI-komponenter
   - `search/` - Sokrelaterat

3. Skapa komponenten:
   - TypeScript (.tsx)
   - Funktionskomponent med named export
   - Props-interface definierat
   - TailwindCSS for styling
   - Anvand Lucide React for ikoner

4. Om typer behovs, lagg till i `frontend/src/types/index.ts`

5. Om API-anrop behovs, lagg till i `frontend/src/services/api.ts`

6. Sammanfatta vad som skapades
