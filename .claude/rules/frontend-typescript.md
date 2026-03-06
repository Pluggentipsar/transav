---
paths:
  - "frontend/**/*.{ts,tsx}"
---

# Frontend TypeScript-regler

## Ramverk
- Next.js 14 App Router (inte Pages Router)
- React 18 med funktionskomponenter och hooks
- TailwindCSS for styling (inga CSS-moduler)
- TanStack Query (React Query) for servertillstand

## Kodstil
- Strict TypeScript - inga `any`-typer
- Namngivning: PascalCase for komponenter, camelCase for funktioner/variabler
- En komponent per fil, filnamn matchar komponentnamn
- Exportera komponenter som named exports, inte default

## Komponentstruktur
- `src/app/` - Next.js App Router sidor
- `src/components/` - Atervandbara komponenter, grupperade per feature
- `src/hooks/` - Custom React hooks
- `src/services/` - API-klient (Axios)
- `src/types/` - TypeScript-typer och interface
- `src/utils/` - Hjalpfunktioner

## State Management
- TanStack Query for all serverdata (caching, polling, invalidering)
- Inga tunga state-bibliotek (Redux/Zustand) - React Query racker
- `usePolling` hook for jobbstatus-polling

## Styling
- Fargschema: Teal primar + mork bakgrund (dark theme)
- Tailwind utility classes, undvik inline styles
- `tailwind-merge` for att hantera klassnamnskonflikter
- Lucide React for ikoner

## API-kommunikation
- Alla API-anrop via `src/services/api.ts`
- Axios med baseURL="/api/v1"
- React Query for alla GET-forfragan, mutations for POST/PATCH/DELETE
