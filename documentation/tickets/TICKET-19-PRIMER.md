# TICKET-19: Quick-Start Templates + Deterministic Board Seeding - Primer

**Use this to start TICKET-19 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, @documentation/tickets/TICKET-12-PRIMER.md, @documentation/tickets/TICKET-18-PRIMER.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-19: Quick-Start Templates + Deterministic Board Seeding.

Current state:
- Dashboard sections now exist (Home/Recent/Starred + search)
- AI planner already supports deterministic template planning for command prompts
- There is still no one-click "start from template" flow on dashboard cards

TICKET-19 Goal:
Ship quick-start template cards and instant board creation from templates:
1) Kanban Board
2) SWOT Analysis
3) Brainstorm
4) Retrospective

Primary implementation paths:
- @app/page.tsx
- @components/ (template cards/sections)
- @app/api/boards/ (template create endpoint)
- @lib/ai-agent/planner.ts (reuse where appropriate)
- @lib/ (new template seed helpers)
- @lib/yjs/ and/or realtime bridge paths for deterministic writes
- @tests/unit/ (template builders)
- @tests/integration/ (seed path + persistence)
- @tests/e2e/board.spec.ts
- @documentation/tickets/DEV-LOG.md
- @documentation/tickets/TICKETS.md

Constraints:
- Template object writes must go through the existing Yjs sync path (same as manual edits)
- Do not bypass Yjs by writing board objects directly to Postgres
- Keep object schema valid for all seeded objects
- No `any` types and explicit error handling
- Follow TDD: tests first, fail, minimum implementation, then pass

After implementation:
- Run lint/build/tests/e2e
- Manual smoke: create each template, open in second browser, verify realtime + persistence
- Update DEV-LOG and mark TICKET-19 complete
```

---

## Quick Reference

**Time Budget:** 3-4 hours  
**Branch:** `feat/start-from-template-gallery`  
**Dependencies:** TICKET-18

---

## Objective

Enable one-click template board creation from the dashboard so users can start with structured layouts without typing AI commands.

---

## Scope Details

### 1) Template gallery section

- Add "Start from Template" section on Home tab
- Include 4 cards with title + short descriptor:
  - Kanban Board
  - SWOT Analysis
  - Brainstorm
  - Retrospective
- Keep visual treatment consistent with the current product style system

### 2) Deterministic template definitions

- Add or reuse deterministic template builders with stable geometry and defaults
- Prefer reusing existing planner/template composition logic where practical
- Ensure seeded objects include required fields and valid z-ordering

### 3) Template board creation flow

- Clicking a template card should:
  1. create a new board row
  2. seed template objects through Yjs mutation path
  3. navigate user to created board
- Handle partial failures safely (rollback or clear recovery messaging)

### 4) Sync + persistence guarantees

- Validate seeded objects replicate to collaborators
- Validate seeded objects persist after refresh/reopen
- Preserve existing board creation path for non-template flow

---

## Technical Notes / Constraints

- If sharing logic with AI planner, isolate reusable template functions in a neutral module (avoid coupling UI to prompt parsing).
- Keep template seeding idempotent per new board creation transaction (avoid duplicate seeding on retry).
- Add explicit typed payload/schema for template create API routes.

---

## Testing / Verification Checklist

### Manual
1. From Home tab, click each template card.
2. New board opens with expected structure/content.
3. Refresh board -> template objects remain.
4. Open same board in second browser -> objects sync correctly.
5. Create plain board (non-template) -> behavior unchanged.
6. Failure path (forced API fail) shows clear user feedback.

### Automated
- Add/adjust tests for:
  - template object builder correctness (counts/types/coordinates)
  - API route validation and template dispatch
  - integration sync/persistence for seeded content
  - E2E happy path per template type (at least smoke-level coverage)
- Keep full regression green:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`

---

## Acceptance Criteria

- Home tab shows quick-start template cards.
- Each template creates a board with deterministic seeded content.
- Seeded content syncs and persists through existing Yjs flow.
- Existing manual board creation and board opening still work.
- Tests and build remain green.
