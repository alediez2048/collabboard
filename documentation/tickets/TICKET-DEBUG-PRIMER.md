# TICKET-DEBUG: Stability + Root-Cause Debugging - Primer

**Use this to start a debugging ticket in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-DEBUG: [short bug title].

Bug report:
- Symptom: [what is failing]
- Expected: [what should happen]
- Actual: [what happens instead]
- Repro steps:
  1) [...]
  2) [...]
  3) [...]
- Frequency: [always / intermittent / only under load]
- Scope impact: [single user / multiplayer / AI path / persistence / deployment]
- Environment: [local/prod, browser, board size, user count]

TICKET-DEBUG Goal:
1) Reproduce the issue reliably
2) Identify root cause with evidence
3) Implement the minimum safe fix
4) Add regression tests so it does not return

Primary investigation paths:
- @components/board/Canvas.tsx
- @lib/yjs/provider.ts
- @server/src/yjs-server.ts
- @server/src/socket-server.ts
- @server/src/persistence.ts
- @app/api/ai/command/route.ts
- @lib/ai-agent/executor.ts
- @server/src/ai-routes.ts
- @tests/unit/
- @tests/integration/
- @tests/e2e/board.spec.ts
- @documentation/tickets/DEV-LOG.md
- @documentation/tickets/TICKETS.md

Constraints:
- Keep state ownership contracts intact:
  - persistent board objects -> Yjs
  - ephemeral cursors -> Socket.io
  - local UI-only state -> Zustand
- Do not bypass Yjs by writing board objects directly to Postgres
- Keep AI mutations on the realtime bridge/Yjs path
- No `any` types; use explicit guards and typed errors
- Follow TDD: add failing test first, implement minimum fix, then pass
- Prefer fixing cause over masking symptoms

Required output:
- Root cause analysis (what failed and why)
- Fix summary (what changed and why it is safe)
- Test evidence (new/updated tests + command outputs)
- Residual risks and follow-up recommendations

After implementation:
- Run lint/build/tests/e2e
- Run focused manual repro before and after fix
- Update DEV-LOG and mark ticket status in TICKETS
```

---

## Quick Reference

**Time Budget:** 1.5-3 hours  
**Branch:** `fix/<bug-slug>`  
**Dependencies:** Current `main` baseline + latest failing repro

---

## Objective

Resolve a production-relevant bug with a reproducible diagnosis, minimal-risk fix, and regression protection.

---

## Scope Details

### 1) Reproduction first

- Convert the report into deterministic steps
- Capture exact trigger conditions (object count, zoom level, number of users, command type, reconnect timing)
- Record baseline evidence before touching code

### 2) Isolate the failing boundary

- Determine where behavior diverges from contract:
  - UI interaction layer (`Canvas`, selection, zoom, render)
  - realtime transport layer (Yjs/socket connection lifecycle)
  - persistence layer (snapshot save/load)
  - AI orchestration/tool execution layer

### 3) Minimal safe fix

- Patch only the failing path(s)
- Keep existing API and event contracts stable unless change is required by root cause
- Preserve existing performance assumptions and data flow invariants

### 4) Regression safety net

- Add or update tests at the lowest effective level:
  - unit for pure helpers/logic
  - integration for sync, reconnect, AI route/executor behavior
  - e2e smoke when user flow crosses system boundaries

---

## Project-Specific Debugging Hotspots

### Canvas / interaction / performance

- `components/board/Canvas.tsx`
- `lib/utils/zoom-interaction.ts`
- `lib/utils/viewport-culling.ts`
- `lib/yjs/board-doc.ts`

### Realtime sync / reconnect

- `lib/yjs/provider.ts`
- `server/src/yjs-server.ts`
- `server/src/socket-server.ts`
- `server/src/persistence.ts`

### AI command path

- `components/board/AICommandBar.tsx`
- `app/api/ai/command/route.ts`
- `lib/ai-agent/tools.ts`
- `lib/ai-agent/executor.ts`
- `lib/ai-agent/planner.ts`
- `server/src/ai-routes.ts`
- `lib/ai-agent/tracing.ts`

### Auth / board access / metadata

- `app/page.tsx`
- `app/board/[id]/page.tsx`
- `app/api/boards/[id]/route.ts`
- `lib/supabase/server.ts`

---

## Testing / Verification Checklist

### Manual
1. Reproduce the bug on current baseline.
2. Apply fix and rerun same repro steps.
3. Validate unaffected adjacent flows still work.
4. If realtime issue: verify with at least 2 browser sessions.
5. If persistence issue: refresh/reopen and verify snapshot restoration.
6. If AI issue: run single-step, follow-up, and deterministic/bulk command paths.

### Automated
- Add/adjust targeted regression tests for the exact failure mode
- Keep full regression green:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`
  - `npm run build --prefix server` (if server touched)

---

## Acceptance Criteria

- Reproduction is reliable and documented.
- Root cause is identified and confirmed with evidence.
- Fix resolves the issue without violating architecture constraints.
- Regression tests cover the failure mode and pass.
- Full project quality gates remain green (lint/build/tests).
