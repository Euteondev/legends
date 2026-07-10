# Finanças Legends

A sticker album gamification app for corporate finance training. Users collect cards, complete missions, and compete on a leaderboard — themed around "Finanças Empresariais Legends 2026".

## Run & Operate

- **Frontend** (port 5000): `cd album && pnpm --filter @workspace/financas-legends run dev`
- **API Server** (port 8080): `cd album && PORT=8080 pnpm --filter @workspace/api-server run dev`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, run from album/)

## Required Environment Variables

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase API key (public client-side key) |
| `PORT` | Port for each server (5000 for frontend, 8080 for API) |
| `BASE_PATH` | Base URL path for the Vite dev server (use `/` in dev) |
| `DATABASE_URL` | Postgres connection string (auto-provided by Replit) |

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React 19, Vite 7, Tailwind CSS 4, shadcn/ui, Wouter (routing), TanStack Query
- **Data**: Firebase Firestore (primary client-side storage), PostgreSQL + Drizzle ORM (API server)
- **API**: Express 5
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle for API server)

## Where things live

- `artifacts/src/` — React frontend source
- `artifacts/src/lib/firebase.ts` — Firebase initialization
- `artifacts/src/lib/db.ts` — Firestore data access (users, cards, missions, collaborators)
- `artifacts/src/hooks/use-db.ts` — React Query hooks wrapping Firestore
- `artifacts/api-server/` — Express API server
- `lib/db/` — Drizzle schema + PostgreSQL client shared package
- `lib/api-spec/` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/` — Generated React Query hooks from Orval
- `lib/api-zod/` — Generated Zod schemas from Orval

## Architecture decisions

- Firebase Firestore is the primary data store for the frontend; PostgreSQL is used by the API server for server-side operations.
- The API server must be started with `PORT=8080` since the global `PORT` env var is set to `5000` for the frontend.
- Firebase API key is a public client-side key (by Firebase design) stored as `VITE_FIREBASE_API_KEY`. It is injected at build time by Vite.

## Product

Users enter with their name and corporate email, then collect sticker cards across categories (common, rare, epic, legendary). They complete missions, earn rewards, and compete on a leaderboard. Themed around a 2026 World Cup / corporate finance narrative.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm install` from inside `album/` (not the workspace root).
- Always run `pnpm --filter @workspace/db run push` from inside `album/` after schema changes.
- The API server inherits `PORT=5000` from the shared env, so always override with `PORT=8080` in its run command.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
