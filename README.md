# CollabBoard

Real-time collaborative whiteboard with an AI command layer.  
Built with Next.js (App Router), Konva, Yjs, Socket.io, Supabase, and OpenAI tooling.

- **Live App:** https://collabboard-gauntlet.vercel.app
- **GitHub:** https://github.com/alediez2048/Gauntlet-Assignment-1
- **Demo Video:** _URL intentionally deferred to final project closeout_

---

## What Is Implemented

- ✅ Email/password auth (Supabase Auth) and protected board routes
- ✅ Board creation/list/open flows
- ✅ Real-time object sync via Yjs CRDT + y-websocket
- ✅ Multiplayer cursors and presence via Socket.io + Yjs awareness
- ✅ Sticky notes, shapes, connectors, frames, selection/transforms
- ✅ Persistence of board state (Yjs snapshots to Supabase)
- ✅ AI board commands (single-step + follow-up + deterministic complex planning)
- ✅ Tracing/observability for AI flows (LangSmith + Langfuse fan-out support)

---

## Architecture At A Glance

1. **Board objects (persistent):** Yjs shared doc (`Y.Map`) is source of truth.
2. **Cursors/presence (ephemeral):** Socket.io broadcast + awareness updates.
3. **Persistence:** Server snapshots Yjs updates to Supabase on debounce.
4. **AI writes:** `/api/ai/command` executes tools and mutates through the same Yjs sync path.

For detailed contracts, see:
- `documentation/architecture/system-design.md`
- `documentation/agents/agents.md`

---

## Quick Start (Fresh Clone)

### 1) Clone + install frontend deps

```bash
git clone https://github.com/alediez2048/Gauntlet-Assignment-1.git
cd Gauntlet-Assignment-1
npm install
```

### 2) Install realtime server deps

```bash
npm install --prefix server
```

### 3) Create env files

```bash
cp .env.example .env.local
cp server/.env.example server/.env
```

Then fill required values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_BRIDGE_SECRET` (same value in both `.env.local` and `server/.env`)

For local full-stack dev defaults:
- `NEXT_PUBLIC_WS_URL=ws://localhost:4000`
- `REALTIME_SERVER_URL=http://localhost:4000`
- `PORT=4000` (server)

### 4) Run both processes

Terminal 1 (realtime server):

```bash
npm run dev --prefix server
```

Terminal 2 (Next.js app):

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Commands

### Frontend (repo root)

```bash
npm run dev
npm run build
npm start
npm run lint
npm test
npm run test:e2e:setup
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:e2e:debug
```

`npm run test:e2e` includes a pretest hook that installs Playwright Chromium if it is missing. On a fresh machine, you can also run `npm run test:e2e:setup` once up front.

### Realtime server (`server/`)

```bash
npm run dev --prefix server
npm run build --prefix server
npm start --prefix server
```

---

## Documentation Map

- `documentation/requirements/PRD.md` - ticket scope and acceptance criteria
- `documentation/architecture/system-design.md` - state ownership and sync contracts
- `documentation/testing/TESTS.md` - test strategy and checklists
- `documentation/tickets/DEV-LOG.md` - implementation history and validation evidence
- `documentation/reference/AI-DEVELOPMENT-LOG.md` - AI workflow, prompts, learnings
- `documentation/reference/AI-COST-ANALYSIS.md` - trace-backed usage and projections

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Canvas | Konva + react-konva |
| Realtime (persistent) | Yjs + y-websocket |
| Realtime (ephemeral) | Socket.io |
| Auth + Database | Supabase |
| Local UI state | Zustand |
| AI | OpenAI function calling + typed tool schema |
| AI Observability | LangSmith + Langfuse |
| Testing | Vitest + Playwright |
| Deployment | Vercel (frontend) + Railway (realtime server) + Supabase |

---

## Project Structure

```text
app/                     Next.js routes and API handlers
components/board/        Canvas + board UI components
lib/ai-agent/            Planner/executor/tooling/tracing logic
lib/sync/                Socket.io cursor transport + throttling helpers
lib/yjs/                 Yjs provider/bootstrap logic
server/                  Socket.io + y-websocket realtime server
stores/                  Local UI-only Zustand store
tests/                   Unit, integration, and E2E suites
documentation/           PRD, architecture, testing, tickets, reference docs
```

---

## Notes For Final Submission

- Add final demo URL + LangSmith dashboard URL + Langfuse dashboard URL in final closeout pass.
- Cost figures are documented in `documentation/reference/AI-COST-ANALYSIS.md` and should be paired with latest dashboard screenshots before submission.

---

**Built by:** JAD  
**Sprint:** Feb 16-23, 2026  
**Assignment:** Gauntlet AI - CollabBoard
