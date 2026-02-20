# TICKET-20: Board Preview Cards + Snapshot Thumbnails + View Toggle - Primer

**Use this to start TICKET-20 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, @documentation/tickets/TICKET-18-PRIMER.md, @documentation/tickets/TICKET-19-PRIMER.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-20: Board Preview Cards + Snapshot Thumbnails + View Toggle.

Current state:
- Dashboard shell/navigation and template entry points are in place
- Board list cards are still mostly text-first and underutilize visual preview capabilities
- We already persist Yjs snapshots in Supabase (`board_snapshots`)

TICKET-20 Goal:
Ship board preview cards with visual previews and view controls:
1) board card thumbnails
2) richer metadata/actions on cards
3) grid/list view toggle

Primary implementation paths:
- @app/page.tsx
- @components/ (board gallery/card components)
- @lib/ (thumbnail derivation helpers)
- @types/
- @stores/ui-store.ts (view mode persistence if needed)
- @tests/unit/ (thumbnail + view helpers)
- @tests/integration/ (snapshot decode paths if added)
- @tests/e2e/board.spec.ts
- @documentation/tickets/DEV-LOG.md
- @documentation/tickets/TICKETS.md

Constraints:
- Do not degrade dashboard performance for users with many boards
- Keep board-object source-of-truth unchanged (Yjs)
- Handle boards with no snapshots gracefully
- Keep strict typing and explicit errors
- Follow TDD workflow

After implementation:
- Run lint/build/tests/e2e
- Manual smoke on dense and empty board sets
- Update DEV-LOG and mark TICKET-20 complete
```

---

## Quick Reference

**Time Budget:** ~3 hours  
**Branch:** `feat/board-gallery-thumbnails`  
**Dependencies:** TICKET-19

---

## Objective

Upgrade board browsing from a plain list into a visual gallery that improves scanability and faster board selection.

---

## Scope Details

### 1) Gallery card redesign

- Introduce board cards with:
  - preview thumbnail area
  - board name + date metadata
  - compact quick actions (open/star/share/delete as applicable)
- Ensure responsive layout across common desktop breakpoints

### 2) Snapshot thumbnail pipeline

- Build a lightweight thumbnail strategy for board previews:
  - derive from latest persisted snapshot when available
  - fallback to deterministic placeholder for empty/new boards
- Keep rendering fast; avoid expensive client work for large lists

### 3) View-mode controls

- Add grid/list toggle in top controls
- Persist preference per user/session (local storage or UI store)
- Ensure both views support key actions and accessibility

### 4) Empty and loading states

- Implement polished states for:
  - no boards
  - no results
  - loading previews
  - preview generation failure

---

## Technical Notes / Constraints

- If decoding Yjs snapshots for previews, isolate logic in pure helpers with unit tests.
- Guard against unbounded payloads: board list route should not fetch/transform excessive snapshot data synchronously.
- Keep card rendering memoized where appropriate to avoid unnecessary re-renders.

---

## Testing / Verification Checklist

### Manual
1. Home/Recent/Starred cards render preview tiles.
2. Boards with no snapshot show fallback placeholder.
3. Grid/list toggle switches layout and persists after refresh.
4. Card actions still work in both view modes.
5. Search + tab filtering continue to work with new card rendering.
6. Large board list remains responsive.

### Automated
- Add/adjust tests for:
  - thumbnail derivation/fallback behavior
  - view mode state persistence
  - card action rendering in grid and list modes
  - E2E smoke for toggle + open-board flow
- Keep full regression green:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`

---

## Acceptance Criteria

- Dashboard board cards include visual previews and richer metadata/actions.
- Users can switch between grid and list views.
- Preview logic handles empty/new boards safely.
- Existing board CRUD/navigation remains intact.
- Performance and regression checks stay green.
