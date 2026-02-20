# TICKET-17: Dashboard Navigation Foundation - Primer

**Use this to start TICKET-17 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, @documentation/tickets/TICKETS.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-17: Dashboard Navigation Foundation.

Current state:
- TICKET-01 through TICKET-16 are complete
- Board list UX exists but is still the basic light "Your Boards" layout
- Board-level collaboration/sync/perf is stable and should not regress

TICKET-17 Goal:
Ship a stronger dashboard information architecture that introduces:
1) reusable dashboard shell layout
2) left navigation for Home / Recent / Starred
3) top action strip (view controls + create board CTA + AI entry point placeholder)
4) scaffolded empty states/sections for the new IA

Primary implementation paths:
- @app/page.tsx
- @app/layout.tsx
- @components/ (new dashboard components as needed)
- @components/create-board-button.tsx
- @stores/ui-store.ts
- @tests/e2e/board.spec.ts
- @tests/unit/ (new dashboard state/view tests)
- @documentation/tickets/DEV-LOG.md
- @documentation/tickets/TICKETS.md

Constraints:
- Keep existing auth and board access behavior
- Keep board object state ownership unchanged (Yjs only)
- No `any` types, typed errors, explicit loading/failure UI
- Preserve existing create/open/delete/rename flows
- Non-goal: matching a specific visual theme from reference screenshots
- Follow TDD: write tests first, confirm failing, then implement minimum to pass

After implementation:
- Run lint/build/tests/e2e
- Manual smoke: login -> dashboard -> navigate tabs -> create board -> open board -> back
- Update DEV-LOG and mark TICKET-17 complete in tracker
```

---

## Quick Reference

**Time Budget:** 2.5-3 hours  
**Branch:** `feat/dashboard-nav-foundation`  
**Dependencies:** TICKET-16

---

## Objective

Move from a single board list view to a structured dashboard IA that scales with discovery features, while keeping existing board workflows fully functional.

---

## Scope Details

### 1) Dashboard shell structure

- Add a reusable shell structure (sidebar + content region + top strip)
- Preserve accessibility: sufficient contrast, visible focus states, keyboard nav

### 2) Sidebar navigation scaffold

- Add left rail with:
  - product/workspace identity
  - search input shell
  - Home / Recent / Starred nav items
  - sign-out affordance
- Use URL state (query param or segment) for active section persistence

### 3) Top actions strip scaffold

- Add dashboard top strip with:
  - workspace/page title
  - view-control placeholder (grid/list toggle shell)
  - "New board" CTA (reuse existing board creation behavior)
  - optional AI shortcut placeholder control

### 4) Empty/home section scaffolding

- Define section containers and empty-state treatment for:
  - Home
  - Recent
  - Starred
- For this ticket, data can reuse existing board query; deeper filtering logic lands in TICKET-18

### 5) Regression protection

- Ensure existing create board and board open links still work
- Ensure board deletion/rename entry points remain discoverable

---

## Technical Notes / Constraints

- This ticket is primarily layout/IA and should avoid backend schema changes.
- Keep data-fetching logic simple and compatible with upcoming TICKET-18 filtering.
- Prefer extracting small presentational components over a single large page component.
- Do not remove existing tested affordances unless replaced with equivalent behavior.

---

## Testing / Verification Checklist

### Manual
1. Authenticated user lands on dashboard shell with navigation + content sections.
2. Sidebar nav switches active state among Home/Recent/Starred.
3. URL preserves active section after refresh.
4. Create board from new top strip still works.
5. Existing board cards/actions remain reachable and functional.
6. Keyboard-only navigation works across sidebar and top controls.

### Automated
- Add/adjust tests for:
  - active nav state derivation
  - shell rendering for empty + non-empty board states
  - create-board CTA visibility/behavior in new chrome
- Keep full regression green:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`

---

## Acceptance Criteria

- New dashboard shell is live behind authenticated home route.
- Sidebar shows Home/Recent/Starred navigation with persistent active state.
- Top strip includes create-board flow and control placeholders needed for upcoming tickets.
- Existing board CRUD/navigation flows still work with no regressions.
- Ticket remains style-agnostic and focused on functional IA improvements.
- Tests and build stay green.
