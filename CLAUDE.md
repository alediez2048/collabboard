# CollabBoard

Real-time collaborative whiteboard with AI agent. Built with Next.js 15, Konva.js, Yjs, Socket.io, Supabase.

## Commands
- Build: `npm run build`
- Dev: `npm run dev`
- Test: `npx vitest run`
- Lint: `npx eslint . --fix`
- Format: `npx prettier --write .`
- Server (WS): `cd server && npm run dev`

## Architecture
- Board objects: Yjs Y.Map (CRDT) synced via y-websocket — single source of truth
- Cursors: Socket.io broadcast (ephemeral, 20-30Hz throttled)
- Persistence: Debounced Yjs snapshots → Supabase Postgres (bytea)
- Auth: Supabase Auth (JWT)
- AI: OpenAI GPT-4o-mini function calling → writes to Yjs doc
- Frontend: Next.js 15 App Router + react-konva
- State: Zustand for UI only (selected tool, zoom, pan). NEVER for board objects.

## Style
- TypeScript strict mode, no `any` types
- Functional React components
- kebab-case files, PascalCase components, camelCase functions
- Conventional Commits: feat:, fix:, refactor:, test:, docs:
- Error handling: always try/catch with typed errors

## Key Files
- `system-design.md` — data flow, state ownership, event schema
- `PRD.md` — ticket breakdown and acceptance criteria
- `agents.md` — coding agent non-negotiables
- `TICKETS.md` — current progress tracker

## Rules
- Board objects ONLY in Yjs Y.Map — never Zustand, never direct Supabase writes
- AI agent tool execution writes to Yjs doc — same path as manual edits
- All WS connections must verify Supabase JWT
- getBoardState() scoped to max 50 objects for AI context
