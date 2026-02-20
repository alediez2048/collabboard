# TICKET-21: Workspace Productivity Controls (Undo/Redo + Clear + Header/Rail Refinement) - Primer

**Use this to start TICKET-21 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, @documentation/tickets/TICKET-16-PRIMER.md, @documentation/tickets/TICKET-20-PRIMER.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-21: Workspace Productivity Controls (Undo/Redo + Clear + Header/Rail Refinement).

Current state:
- Canvas interactions and performance are stable
- Board view has functional controls, but control surfaces can be better organized for speed and clarity
- Undo/redo and clear-board controls are not yet fully surfaced as first-class UX actions

TICKET-21 Goal:
Improve board-view productivity controls and add core editing affordances:
1) top board bar (back, board name, save status, avatar, clear, share)
2) left vertical tool rail
3) undo/redo controls + keyboard shortcuts
4) clear board action with confirmation

Primary implementation paths:
- @app/board/[id]/page.tsx
- @components/board/Canvas.tsx
- @components/board/Toolbar.tsx
- @components/board/BoardHeader.tsx (or replacement components)
- @components/board/ShareButton.tsx
- @components/ui/ (confirmation/dialog components)
- @stores/ui-store.ts
- @lib/yjs/board-doc.ts
- @tests/unit/ (undo manager + clear behavior)
- @tests/e2e/board.spec.ts
- @documentation/tickets/DEV-LOG.md
- @documentation/tickets/TICKETS.md

Constraints:
- Board object changes still flow only through Yjs shared document
- Preserve existing multiplayer sync and performance improvements
- No `any` types, explicit typed error paths
- Keep owner/member access semantics intact (clear-board authorization)
- Follow TDD

After implementation:
- Run lint/build/tests/e2e
- Manual smoke with 2 browsers: undo/redo/clear sync behavior
- Update DEV-LOG and mark TICKET-21 complete
```

---

## Quick Reference

**Time Budget:** 3-4 hours  
**Branch:** `feat/workspace-productivity-controls`  
**Dependencies:** TICKET-20

---

## Objective

Upgrade in-board control surfaces to improve speed, clarity, and consistency while adding critical editing controls (undo/redo/clear).

---

## Scope Details

### 1) Top workspace bar

- Build a persistent top bar containing:
  - back navigation
  - board name label
  - save status indicator (e.g., Saving... / Saved)
  - collaborator/avatar slot
  - clear-board button
  - share button
- Keep responsive behavior and keyboard focus order clean

### 2) Vertical left tool rail

- Convert toolbar layout to vertical rail with icon-first controls
- Keep existing tools discoverable and maintain current behaviors
- Reserve optional slots for future tools (comment, hand, etc.)

### 3) Undo/redo support

- Add undo/redo buttons in rail (or lower rail group)
- Add keyboard shortcuts:
  - Cmd/Ctrl+Z (undo)
  - Shift+Cmd/Ctrl+Z (redo)
- Implement with `Y.UndoManager` (or equivalent) against board object map

### 4) Clear board action

- Add explicit clear-board control with confirmation modal
- Clear operation should remove all board objects via Yjs transaction
- Respect authorization rules (owner-only if required by product decision)

### 5) Status/feedback polish

- Provide clear affordance states:
  - disabled undo/redo
  - clear in progress
  - save state transitions
- Ensure no overlap conflicts with existing overlays (AI bar, color picker, presence)

---

## Technical Notes / Constraints

- Keep current viewport/pan/zoom and object interaction pipelines untouched unless required.
- Avoid introducing render regressions in dense boards; validate with existing perf checks.
- Reuse existing shared confirmation dialog patterns from board delete flow where possible.

---

## Testing / Verification Checklist

### Manual
1. Top bar renders all expected controls and board name.
2. Undo/redo buttons and shortcuts work for create/move/edit/delete.
3. Undo/redo sync behavior remains coherent in second browser.
4. Clear board requires confirmation and removes all objects.
5. Clear-board result persists after refresh/reopen.
6. Existing share/back/presence/AI flows still work.

### Automated
- Add/adjust tests for:
  - undo/redo command wrapper behavior
  - clear-board transaction behavior
  - toolbar active-state rendering
  - E2E keyboard shortcuts and clear confirmation flow
- Keep full regression green:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`

---

## Acceptance Criteria

- Board page has a clearer, more productive top + left control layout.
- Undo/redo works via UI and keyboard shortcuts.
- Clear-board action is safe, confirmed, and syncs/persists correctly.
- Existing collaboration and AI behaviors remain stable.
- Tests/build pass with no major regressions.
