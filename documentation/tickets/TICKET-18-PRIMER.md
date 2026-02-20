# TICKET-18: Board Discovery Metadata (Home / Recent / Starred + Search) - Primer

**Use this to start TICKET-18 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, @documentation/tickets/TICKET-17-PRIMER.md, @documentation/tickets/TICKETS.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-18: Board Discovery Metadata (Home / Recent / Starred + Search).

Current state:
- TICKET-17 dashboard shell/nav is in place
- Board list data model currently only includes base board metadata
- No per-user "starred" state or robust "recently viewed" behavior yet

TICKET-18 Goal:
Implement real data behavior for discovery workflows:
1) Home, Recent, Starred sections with real filtering
2) per-user star/favorite board state
3) recent board tracking based on open activity
4) board search on name/metadata

Primary implementation paths:
- @app/page.tsx
- @app/board/[id]/page.tsx
- @app/api/boards/ (new routes as needed)
- @components/ (sidebar/search/star controls)
- @types/
- @lib/supabase/
- @supabase/migrations/ (new migration for discovery metadata)
- @tests/e2e/board.spec.ts
- @tests/integration/ (query + API behavior)
- @tests/unit/ (filter/sort helpers)
- @documentation/tickets/DEV-LOG.md
- @documentation/tickets/TICKETS.md

Constraints:
- Preserve existing board access controls and RLS guarantees
- Keep Yjs object-state ownership unchanged
- Use typed schemas, no `any`, explicit error handling
- Follow TDD strictly: tests first -> fail -> minimum implementation -> pass

After implementation:
- Run lint/build/tests/e2e
- Manual smoke with two users: star behavior and recent ordering are user-specific
- Update DEV-LOG and mark TICKET-18 complete
```

---

## Quick Reference

**Time Budget:** ~3 hours  
**Branch:** `feat/board-discovery-model`  
**Dependencies:** TICKET-17

---

## Objective

Turn dashboard navigation from visual scaffolding into true discovery behavior so Home, Recent, and Starred become meaningful and reliable.

---

## Scope Details

### 1) Per-user board metadata model

- Add a migration introducing per-user discovery state (example: `board_user_state`)
- Track at minimum:
  - `board_id`
  - `user_id`
  - `is_starred`
  - `last_opened_at`
- Add indexes for common query paths and RLS policies for per-user isolation

### 2) Recent behavior

- Record/update `last_opened_at` whenever a user opens a board
- Implement Recent tab query sorted by most recently opened
- Ensure opening a shared board updates only the current user's recent state

### 3) Starred behavior

- Add star/unstar action from board cards/list rows
- Persist star state in Supabase
- Starred tab displays only boards starred by current user

### 4) Search behavior

- Implement dashboard search filtering over board name (and optional owner label)
- Apply search consistently across active section (Home/Recent/Starred)
- Include clear empty-state messaging for zero matches

### 5) Error/loading handling

- Add resilient UX for metadata fetch failures and optimistic toggles
- Roll back optimistic star state on API failure

---

## Technical Notes / Constraints

- Keep `boards` table semantics unchanged; add metadata through separate join table.
- Avoid full-table client filtering for large board sets; push filtering/sorting to query layer where feasible.
- Preserve owner/member visibility semantics from current RLS setup.

---

## Testing / Verification Checklist

### Manual
1. Open boards in sequence -> Recent order updates correctly.
2. Star/unstar a board -> state persists after refresh.
3. Starred tab shows only starred boards.
4. Search filters list in each tab and shows "no results" states correctly.
5. In two separate user sessions, star/recent state remains isolated per user.
6. Shared board visibility remains intact.

### Automated
- Add/adjust tests for:
  - star toggle reducer/helper logic
  - recent ordering and section filters
  - API route behavior (auth + validation + persistence)
  - integration coverage for user-isolated metadata
- Keep full regression green:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`

---

## Acceptance Criteria

- Home/Recent/Starred tabs each show correct data, not placeholders.
- Starred state is per-user, persistent, and reversible.
- Recent ordering updates when boards are opened.
- Search works across active section with useful empty/error states.
- No regressions to board access controls, sync, or existing CRUD flows.
