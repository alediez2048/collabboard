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
- [ ] **TICKET-11** — AI Agent: Basic Commands (~3 hrs)
- [ ] **TICKET-12** — AI Agent: Complex Commands (~2.5 hrs)

## Polish + Docs (Due: Sun 10:59 PM CT)

- [ ] **TICKET-13** — Performance Profiling + Hardening (~2 hrs)
- [ ] **TICKET-14** — Documentation + AI Dev Log + Cost Analysis (~2 hrs)
- [ ] **TICKET-15** — Final Polish + Social Post (~1.5 hrs)

## Notes

_Update this file after completing each ticket. Add a one-line note if you deviated from the PRD._

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
