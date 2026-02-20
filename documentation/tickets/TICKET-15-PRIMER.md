# TICKET-15: Board Management + Final Polish + Social Post - Primer

**Use this to start TICKET-15 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @documentation/agents/agents.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, @documentation/tickets/TICKET-14-PRIMER.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-15: Board Management + Final Polish + Social Post.

Current state:
- ✅ TICKET-01 through TICKET-14 are complete on main
- ✅ Real-time sync, persistence, and AI command flows are implemented and stable
- ✅ Documentation and cost-analysis deliverables are in place

TICKET-15 Goal:
Ship final board-management UX and polish pass for submission readiness:
1) inline board rename
2) board delete with confirmation
3) board exit/back navigation
4) board-name visibility in header
5) share button (copy board URL)
6) final UI polish + edge-case handling

Primary implementation + validation paths:
- @app/page.tsx
- @app/board/[id]/page.tsx
- @components/board/
- @components/ui/
- @lib/supabase/
- @types/
- @tests/e2e/
- @tests/unit/
- @documentation/tickets/DEV-LOG.md
- @documentation/tickets/TICKETS.md

Constraints:
- Keep Yjs as source of truth for board objects
- Keep cursor state ephemeral via Socket.io
- No `any` types
- Preserve auth protections and existing AI/realtime behavior
- No direct board-object writes to Postgres (board metadata CRUD only where appropriate)
- Keep error handling explicit and user-friendly

After implementation:
- Run lint/build/tests
- Perform manual end-to-end smoke (signup -> create board -> rename/delete/share/exit)
- Verify no regressions in AI command + multiplayer sync flows
- Update DEV-LOG and mark TICKET-15 completion in tracker
```

---

## Quick Reference

**Time Budget:** 3 hours  
**Branch:** `feat/board-management` (or short-lived branch from `main`)  
**Dependencies:** TICKET-14 completion

---

## Objective

Ship final board-management and polish improvements:
1. Manage boards directly from board list (rename/delete)
2. Improve in-board navigation and context (back button + board name)
3. Add share UX (copy current board URL)
4. Smooth rough UI/edge-case behavior before submission

---

## Scope Details

### 1) Board management from list page

- Inline board rename:
  - click board name -> editable input
  - save to `boards.name`
  - validation: non-empty, <= 100 chars
- Delete board:
  - delete action per board row/card
  - confirmation modal ("This cannot be undone")
  - UI updates immediately after success

### 2) Board view navigation + context

- Add "Back to Boards" control in board view
- Show current board name in board header/navbar
- Ensure load/failure states are clean when board metadata fetch fails

### 3) Share flow

- Add Share button in board view
- Copy current board URL to clipboard
- Show clear success/error toast/feedback

### 4) Final polish + edge cases

- Consistent colors, hover states, focus states, loading states
- Handle empty states and long text overflow safely
- Improve surface-level error messaging where currently generic

---

## Technical Notes / Constraints

- Board-object state ownership remains unchanged:
  - persistent board objects -> Yjs
  - ephemeral cursors -> Socket.io
- Board metadata operations (rename/delete/list) may use Supabase tables as designed.
- Keep strict TypeScript typing and explicit error boundaries.
- Avoid architecture changes unless required to satisfy acceptance criteria.

---

## Testing / Verification Checklist

### Manual
1. Rename board from list; refresh; name persists.
2. Attempt invalid rename (empty/whitespace); validation blocks save.
3. Delete board with confirmation; board is removed and no stale navigation remains.
4. Open board; confirm board name visible in header.
5. Use back/exit button; returns to board list.
6. Use share button; link copied; paste opens same board.
7. Regression smoke: AI command still works, sync still updates in second browser.

### Automated
- Add/adjust tests for board-management UX where practical (unit/E2E).
- Keep full regression green:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npm run build --prefix server` (if server touched)

---

## Acceptance Criteria

- ✅ User can rename any board from list page
- ✅ User can delete boards with confirmation
- ✅ Board view has functional back/exit navigation
- ✅ Current board name shown in header
- ✅ Share button copies board URL successfully
- ✅ End-to-end deployed app flow works for new user
- ✅ Final delivery tasks completed (AI interview + social post + portal upload)
