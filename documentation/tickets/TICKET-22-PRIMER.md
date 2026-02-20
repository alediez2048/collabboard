# TICKET-22: Canvas Comment Pins + Threaded Discussions - Primer

**Use this to start TICKET-22 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, @documentation/tickets/TICKET-21-PRIMER.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-22: Canvas Comment Pins + Threaded Discussions.

Current state:
- Board editing UI is mature, but there is no dedicated comment pin/thread workflow
- Reference workflow includes on-canvas discussion cards anchored to board positions
- Realtime sync/persistence architecture already exists and should be reused

TICKET-22 Goal:
Ship collaborative on-canvas comments:
1) drop a comment pin on canvas
2) open/continue a thread anchored to that location
3) see thread changes sync in real time across users
4) persist comments across refresh/reload

Primary implementation paths:
- @components/board/Canvas.tsx
- @components/board/Toolbar.tsx
- @components/board/ (new comment pin/thread components)
- @lib/yjs/board-doc.ts (or related typed models/helpers)
- @types/
- @stores/ui-store.ts
- @tests/unit/ (comment object helpers)
- @tests/integration/yjs-sync.test.ts (comment concurrency paths)
- @tests/e2e/board.spec.ts
- @documentation/tickets/DEV-LOG.md
- @documentation/tickets/TICKETS.md

Constraints:
- Keep board state ownership in Yjs (no direct Postgres writes for comment objects)
- Use typed schemas; no `any`
- Preserve existing canvas performance and interaction behavior
- Follow realtime test constraints: multi-doc sync, reconnect, conflict checks
- Follow TDD: tests first, fail, minimum implementation to pass

After implementation:
- Run lint/build/tests/e2e
- Manual 2-browser comment flow (create/reply/resolve)
- Update DEV-LOG and mark TICKET-22 complete
```

---

## Quick Reference

**Time Budget:** 3-4 hours  
**Branch:** `feat/canvas-comment-threads`  
**Dependencies:** TICKET-21

---

## Objective

Add context-aware board conversations by letting collaborators place pins and discuss directly on the canvas.

---

## Scope Details

### 1) Comment data model

- Add typed comment-thread representation that fits current board sync model
- Recommended approach: represent comment threads as board objects in Yjs with properties for thread messages/status
- Include required object fields (`id`, `type`, `x`, `y`, `width`, `height`, `createdBy`, `updatedAt`)

### 2) Comment interaction flow

- Add comment tool in toolbar
- Click canvas to place a comment pin and open composer
- Submit first message to create thread
- Reopen pin to add replies

### 3) Thread UI

- Show compact thread card/popover anchored near pin
- Display author + timestamp + message text
- Support resolve/close behavior (at least soft-hide resolved threads)

### 4) Realtime + persistence

- Thread creation and replies sync to other connected users
- Threads persist after refresh/reload through existing Yjs snapshot path
- Handle concurrent replies safely (CRDT-friendly update approach)

### 5) UX guardrails

- Prevent accidental pin placement while pan/dragging
- Keep thread overlays readable at varying zoom levels
- Ensure keyboard escape/cancel flows close composer cleanly

---

## Technical Notes / Constraints

- Keep comment rendering isolated enough to avoid re-rendering all canvas objects on every thread update.
- Maintain compatibility with selection, drag, and tool switching behavior.
- If message arrays are used in object properties, design update strategy to avoid clobbering concurrent writes.

---

## Testing / Verification Checklist

### Manual
1. Place a comment pin and submit first message.
2. Open same board in second browser; verify pin/thread appears.
3. Add replies from both users; verify sync and ordering.
4. Refresh both browsers; verify threads persist.
5. Resolve/close a thread; verify expected visibility behavior.
6. Regression: shape/sticky editing and AI command flows still work.

### Automated
- Add/adjust tests for:
  - comment-thread object creation/update helpers
  - conflict-safe concurrent reply behavior in integration tests
  - reconnect/recovery behavior for comment updates
  - E2E smoke for create + reply flows
- Keep full regression green:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`

---

## Acceptance Criteria

- Users can place comment pins and create threaded discussions on canvas.
- Comment threads sync in real time across collaborators.
- Comment threads persist across reloads/reopens.
- Existing board editing and sync features do not regress.
- Tests/build remain green.
