# CollabBoard — Ticket Tracker

## MVP Sprint (Due: Tue 11:59 PM CT)

- [x] **TICKET-01** — Project Scaffold + Auth (~2 hrs) ✅ Completed Feb 16
- [x] **TICKET-02** — Konva Canvas with Pan/Zoom (~1.5 hrs) ✅ Completed Feb 16
- [x] **TICKET-03** — y-websocket Server + Yjs Provider (~3 hrs) ✅ Completed Feb 17
- [x] **TICKET-04** — Sticky Note CRUD via Yjs (~2.5 hrs) ✅ Completed Feb 17
- [x] **TICKET-05** — Multiplayer Cursors via Socket.io (~1.5 hrs) ✅ Completed Feb 17
- [x] **TICKET-06** — Presence Awareness (~1 hr) ✅ Completed Feb 17
- [x] **TICKET-07** — State Persistence Yjs → Supabase (~2 hrs) ✅ Completed Feb 17

## Feature Expansion (Due: Fri 11:59 PM CT)

- [x] **TICKET-08** — Shapes: Rectangle, Circle, Line (~2 hrs) ✅ Completed Feb 17
- [x] **TICKET-09** — Connectors + Frames (~2.5 hrs) ✅ Completed Feb 17–18
- [x] **TICKET-10** — Selection + Transforms (~2 hrs) ✅ Completed Feb 18
- [x] **TICKET-11** — AI Agent: Basic Commands (~3 hrs) ✅ Completed Feb 18
- [x] **TICKET-12** — AI Agent: Complex Commands (~2.5 hrs) ✅ Completed Feb 19

## Polish + Docs (Due: Sun 10:59 PM CT)

- [x] **TICKET-13** — Performance Profiling + Hardening (~2 hrs) ✅ Completed Feb 19
- [x] **TICKET-13.1** — Zoom Interaction Hardening (~0.75-1 hr) ✅ Completed Feb 20
- [x] **TICKET-13.5** — LLM Observability (Langfuse/LangSmith) + Dashboard Walkthrough (~1–1.5 hrs) ✅ Completed Feb 20
- [x] **TICKET-14** — Documentation + AI Dev Log + Cost Analysis (~2 hrs) ✅ Completed Feb 20 (URLs deferred)
- [x] **TICKET-15** — Board Management + Final Polish + Social Post (~3 hrs) ✅ Completed Feb 20

## Post-Submission Optimization Backlog

- [x] **TICKET-16** — High-Object Performance Deep Dive (~3–4 hrs) ✅ Completed Feb 20

## Functional Expansion Backlog (Reference-Informed)

- [ ] **TICKET-17** — Dashboard Information Architecture + Navigation Foundation (~2.5–3 hrs)
- [ ] **TICKET-18** — Board Discovery Metadata: Home / Recent / Starred + Search (~3 hrs)
- [ ] **TICKET-19** — Quick-Start Templates + Deterministic Board Seeding (~3–4 hrs)
- [ ] **TICKET-20** — Board Preview Cards + Snapshot Thumbnails + View Toggle (~3 hrs)
- [ ] **TICKET-21** — Workspace Productivity Controls (Undo/Redo + Clear + Header/Rail Refinement) (~3–4 hrs)
- [ ] **TICKET-22** — Canvas Comment Pins + Threaded Discussions (~3–4 hrs)

## Notes

_Update this file after completing each ticket. Add a one-line note if you deviated from the PRD._

### TICKET-12 (Kickoff Feb 18, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-12-PRIMER.md`
- 🎯 Focus: multi-step AI planning/execution for complex board setup and layout commands
- ✅ Completed Feb 19, 2026 — templates improved (SWOT 2x2 + journey stickies), collision-aware placement added, AI tests passing

### TICKET-13 (Kickoff Feb 19, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-13-PRIMER.md`
- 🎯 Focus: performance profiling + hardening (fps/sync latency/object-count resilience + reconnect behavior)
- ✅ Completed Feb 19, 2026 — viewport culling + batched Yjs observer updates + cursor throughput hardening + per-room persistence debounce hardening + reconnect/recovery stress tests passing

### TICKET-13.1 (Completed Feb 20, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-13.1-PRIMER.md`
- ✅ Focus delivered: zoom interaction hardening (delta-based zoom curve, smoother wheel/trackpad behavior, pointer-anchor stability)

### TICKET-13.5 (Completed Feb 20, 2026)
- 📌 Focus: instrument and validate AI traces in Langfuse/LangSmith, including planner/executor step visibility
- ✅ Outcome: route/executor lifecycle visibility and trace metadata now validated in both platforms

### TICKET-14 (Completed Feb 20, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-14-PRIMER.md`
- ✅ Delivered: submission-ready README + AI development log + trace-backed cost analysis
- ⏳ Deferred to final project closeout: demo video URL + LangSmith dashboard URL + Langfuse dashboard URL

### TICKET-15 (Completed Feb 20, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-15-PRIMER.md`
- ✅ Focus delivered: board management UX (rename/delete/back/share) + final polish + submission wrap-up
- ✅ Added: inline board rename + owner-only rename API + reusable confirm dialog + board header/back nav + share feedback hardening
- ✅ Tests: `npm test` (195/195), `CI= npm run test:e2e` (12/12), `npm run build` (pass), `npm run lint` (0 errors)

### TICKET-16 (Kickoff Feb 20, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-16-PRIMER.md`
- 🎯 Focus: sustained canvas responsiveness under dense boards (1000+ objects), including pan/zoom, selection/drag, and multiplayer sync stability
- ✅ Completed Feb 20, 2026 — incremental Yjs object-array patching, lookup reuse in selection/culling paths, connector point precomputation, bounded cursor queueing, and dense-board benchmark evidence recorded
- ✅ Added stress coverage for 1000/2000 object sync paths and dense-board incremental benchmark tests
- ✅ Tests/verification: `npm run lint` (0 errors), `npm test` (210/210), `CI= npm run test:e2e` (12/12), `npm run build` (pass), `npm run build --prefix server` (pass)

### TICKET-17 (Planned Feb 20, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-17-PRIMER.md`
- 🎯 Focus: deliver a stronger dashboard information architecture and navigation foundation (sidebar + top controls + section scaffolding), informed by reference workflows (not visual parity)

### TICKET-18 (Planned Feb 20, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-18-PRIMER.md`
- 🎯 Focus: implement per-user board discovery metadata and behavior for Home/Recent/Starred tabs with real search/filter support

### TICKET-19 (Planned Feb 20, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-19-PRIMER.md`
- 🎯 Focus: add quick-start template cards (Kanban/SWOT/Brainstorm/Retro) with deterministic seeded board creation through the existing Yjs sync path

### TICKET-20 (Planned Feb 20, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-20-PRIMER.md`
- 🎯 Focus: upgrade board list cards to gallery previews with snapshot thumbnails, quick actions, and view-mode switching

### TICKET-21 (Planned Feb 20, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-21-PRIMER.md`
- 🎯 Focus: improve in-board productivity controls (top status/header refinements + left tool organization) and add undo/redo + clear-board controls

### TICKET-22 (Planned Feb 20, 2026)
- 📌 Primer created: `documentation/tickets/TICKET-22-PRIMER.md`
- 🎯 Focus: add collaborative canvas comment pins and lightweight threaded discussion UX

### TICKET-11 (Completed Feb 18, 2026)
- ✅ All acceptance criteria met for basic AI command flow
- ✅ Added AI command bar + authenticated `/api/ai/command` route + tool schema/validator/executor stack
- ✅ Added realtime bridge endpoints (`/ai/mutate`, `/ai/board-state`) so AI writes flow through live Yjs docs
- ✅ Fixed runtime blockers: API key env override, bridge secret mismatch, empty sticky text normalization
- ✅ Added follow-up tool pass after `getBoardState` to resolve and mutate existing objects reliably
- ✅ Tests: AI unit/integration suites added; full project tests passing (121/121)

### TICKET-10 (Completed Feb 18, 2026)
- ✅ All acceptance criteria met
- ✅ Click-to-select for sticky notes, shapes (rect/circle/line), frames, connectors
- ✅ Konva Transformer (resize + rotate) for sticky notes, rect, circle, frame
- ✅ Lines and connectors excluded from Transformer (selection highlight only)
- ✅ All geometry mutations write through `updateObject()` to Yjs — syncs + persists
- ✅ `rotation` prop flows from Yjs through all components — existing objects render correctly
- ✅ `boundBoxFunc` enforces 20px minimum size during live drag
- ✅ Viewport persistence: zoom + pan saved per board to localStorage, restored on refresh
- Added: `lib/utils/geometry.ts` — `normalizeGeometry()` pure helper (scale → absolute px + minSize clamp)
- Added: `lib/utils/viewport-storage.ts` — `saveViewport`/`loadViewport` with per-board key, zoom clamp, fallback defaults
- Added: `tests/unit/transforms.test.ts` — 7 tests for `normalizeGeometry`
- Added: `tests/unit/viewport-storage.test.ts` — 11 tests for viewport persistence
- Tests: 69/69 passing

### TICKET-01 (Completed Feb 16, 2026)
- ✅ All acceptance criteria met
- ✅ Deployed to Vercel: https://collabboard-gauntlet.vercel.app
- ✅ GitHub: https://github.com/alediez2048/Gauntlet-Assignment-1
- Added: Supabase CLI setup for database management
- Added: Email confirmation disabled programmatically via CLI
- Fixed: Linter warning in middleware.ts (unused options parameter)
- Deviation: Renamed directory to remove spaces (Vercel requirement)

### TICKET-02 (Completed Feb 16, 2026)
- ✅ All acceptance criteria met
- ✅ Full-viewport Konva canvas with infinite pan and zoom
- ✅ Dot grid background that scales with zoom
- ✅ Zoom level indicator (bottom-right)
- ✅ Toolbar stub with tool icons (visual only)
- Fixed: Hydration mismatch by using dynamic import with ssr: false
- Performance: 60fps pan/zoom, optimized grid rendering

### TICKET-03 (Completed Feb 17, 2026)
- ✅ All acceptance criteria met
- ✅ Node.js y-websocket + Socket.io server created in `server/` directory
- ✅ JWT authentication on all WebSocket connections
- ✅ Client-side Yjs provider connects to server
- ✅ Y.Doc with Y.Map initialized for board objects
- ✅ Socket.io client for cursor broadcast
- ✅ Connection status indicators in UI (Yjs + Socket.io)
- ✅ 9 Vitest integration tests passing (100%)
- ✅ TypeScript strict mode, zero linter errors
- ✅ Build successful, production-ready
- Fixed: WebSocket upgrade routing — `ws` library `path` option does exact match, but y-websocket sends `/yjs/{roomName}`. Switched to `noServer: true` + manual `server.on('upgrade')` with prefix matching.
- Note: Server runs locally, Railway deployment pending (can deploy when ready)
