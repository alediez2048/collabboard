# TICKET-18.1: Toolbar Authoring Expansion (Text Styling + Select/Hand Modes + Pencil/Eraser + Undo/Redo) - Primer

**Use this to start TICKET-18.1 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, @documentation/tickets/TICKET-18-PRIMER.md, @documentation/tickets/TICKET-21-PRIMER.md, @documentation/tickets/TICKETS.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-18.1: Toolbar Authoring Expansion (Text Styling + Select/Hand Modes + Pencil/Eraser + Undo/Redo).

Current state:
- Toolbar UI and basic tools exist, but tool depth is limited
- Text tool can place text objects, but style controls are missing (font family/size/color)
- Selection and board movement interactions need clearer mode separation (Select vs Hand)
- No freehand pencil or eraser workflow yet
- Undo/redo controls are not fully productized in the toolbar workflow

TICKET-18.1 Goal:
Expand toolbar functionality to support real authoring workflows:
1) Rich text controls (font choice, size, color, core formatting)
2) Explicit Select mode and Hand mode behavior
3) Freehand pencil drawing with color + stroke width controls
4) Eraser mode for freehand strokes
5) Undo/redo controls (UI + keyboard shortcuts)
6) Sticky note authoring improvements (style/format quality-of-life)

Primary implementation paths:
- @components/board/Toolbar.tsx
- @components/board/Canvas.tsx
- @components/board/TextEditor.tsx
- @components/board/StickyNote.tsx
- @components/board/Shape.tsx (and/or dedicated freehand component)
- @components/board/ColorPicker.tsx (or expanded style panel)
- @stores/ui-store.ts
- @lib/yjs/board-doc.ts
- @types/
- @tests/unit/
- @tests/integration/
- @tests/e2e/board.spec.ts
- @documentation/tickets/DEV-LOG.md
- @documentation/tickets/TICKETS.md

Constraints:
- All board mutations must still flow through Yjs shared document
- Preserve multiplayer sync and persistence behavior
- Keep interactions responsive on dense boards
- No `any` types and explicit typed error paths
- Keep keyboard shortcuts predictable and conflict-safe
- Follow TDD strictly: tests first -> fail -> minimum implementation -> pass

After implementation:
- Run lint/build/tests/e2e
- Manual smoke in two browser sessions for sync behavior
- Update DEV-LOG and mark TICKET-18.1 complete
```

---

## Quick Reference

**Time Budget:** 4-6 hours  
**Branch:** `feat/toolbar-authoring-expansion`  
**Dependencies:** TICKET-18, TICKET-16 baseline performance work

---

## Objective

Turn the toolbar from basic tool toggles into a full authoring surface that supports realistic day-to-day board creation and editing.

---

## Scope Details

### 1) Text authoring controls

- Expand text workflow beyond insertion:
  - font family picker
  - font size control
  - text color control
  - basic emphasis options (for example: bold/regular)
- Ensure text style properties persist on the text object schema and survive reload/reopen.
- Keep text editing entry points intuitive:
  - create text -> immediate edit mode
  - double-click existing text -> reopen editor

### 2) Select mode vs Hand mode

- Define clear mode behavior:
  - **Select mode:** object selection + marquee selection + object transforms
  - **Hand mode:** click-drag pans the board, without accidental object edits
- Ensure tool state reflects active mode clearly in the rail.
- Align pointer cursors and drag semantics with each mode.

### 3) Pencil (freehand draw) tool

- Add a pencil tool for freehand strokes.
- Add stroke controls:
  - color
  - width
- Store strokes as board objects in Yjs (typed schema), with safe defaults.
- Keep stroke creation performant and robust for long paths.

### 4) Eraser tool

- Add eraser mode with hit behavior suitable for freehand content.
- At minimum, erase freehand strokes cleanly and predictably.
- Ensure erasing participates in undo/redo and syncs across collaborators.

### 5) Undo/redo toolbar controls

- Add back/forward controls in the board toolbar/rail.
- Support keyboard shortcuts:
  - Cmd/Ctrl+Z (undo)
  - Shift+Cmd/Ctrl+Z (redo)
- Ensure controls expose disabled states when no actions are available.
- Verify state convergence across sessions after undo/redo operations.

### 6) Sticky note quality-of-life improvements

- Add practical sticky formatting controls (for example color/size/text formatting parity where applicable).
- Ensure sticky edits remain consistent with existing object schema and transforms.

---

## Technical Notes / Constraints

- Keep board object source of truth in Yjs; no direct object writes to Postgres.
- If adding new object types (for example freehand), define strict typed schema and migration-safe defaults.
- Reuse existing overlay/panel patterns where possible to avoid UI fragmentation.
- Avoid regressions in existing tools (shape draw, connectors, text insert, delete, pan/zoom).

---

## Testing / Verification Checklist

### Manual
1. Text tool inserts text and allows style edits (font, size, color).
2. Select mode supports marquee/object selection as expected.
3. Hand mode pans board by drag without accidental selection edits.
4. Pencil draws freehand strokes with chosen color/width.
5. Eraser removes strokes reliably.
6. Undo/redo works via buttons and keyboard shortcuts.
7. In a second browser, created/edited/erased content syncs correctly.
8. Refresh/reopen preserves toolbar-created content and styles.

### Automated
- Add/adjust tests for:
  - text style persistence and serialization
  - mode behavior (select vs hand) helpers/state
  - freehand stroke creation + erase logic
  - undo/redo command behavior
  - e2e workflows for text/pencil/eraser/undo-redo
- Keep full regression green:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`

---

## Acceptance Criteria

- Toolbar supports rich text editing controls, not text insertion only.
- Users can explicitly switch between Select and Hand interaction modes.
- Pencil and eraser workflows are available and reliable.
- Undo/redo controls work through both toolbar and shortcuts.
- Sticky note authoring has improved formatting ergonomics.
- Existing collaboration, persistence, and performance behavior remains stable.
