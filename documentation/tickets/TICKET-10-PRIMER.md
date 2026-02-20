# TICKET-10: Selection + Transforms — Primer

**Use this to start TICKET-10 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-10: Selection + Transforms.

Current state:
- ✅ Board objects are stored in a Yjs shared doc as a Y.Map named "objects"
- ✅ Object types include: sticky notes, rectangle, circle, line, connector, frame
- ✅ Objects can be created and dragged; all changes sync via Yjs
- ✅ Persistence snapshots save/load reliably on refresh/reconnect
- ✅ Presence awareness is scoped per-board room and shows correct online counts

TICKET-10 Goal:
Add selection tooling and transform controls (move/resize/rotate) for supported
objects, with live multiplayer sync and persistence. Use Konva's Transformer for
resize/rotate. Ensure coordinate transforms work under pan/zoom and that all
mutations write to Yjs (never Zustand).

Key files:
- @components/board/Canvas.tsx (selection state, event handlers, object rendering)
- @components/board/StickyNote.tsx, @components/board/Shape.tsx, @components/board/Frame.tsx
- @lib/yjs/board-doc.ts (addObject/updateObject/removeObject helpers)

After completion, follow the TICKET-10 testing checklist.
```

---

## Quick Reference

**Time Budget:** 2 hours  
**Branch:** `feat/selection-transforms` (create from `main`)  
**Dependencies:** TICKET-04/08 object drag patterns, TICKET-09 frames/connectors

---

## Objective

Implement:
1. **Selection**: click-to-select, click-empty to deselect, consistent visual affordances
2. **Transforms**: resize + rotate using Konva Transformer (where applicable)
3. **Multi-select (optional stretch)**: shift-click add/remove, transformer around group

All changes must:
- Write through `updateObject()` to the Yjs `objects` map
- Sync in real time to other clients
- Persist across hard refresh

---

## Scope Details

### Supported object transform behavior

- **Sticky notes** (`sticky_note`):
  - Select: show outline / handles
  - Resize: update `width`/`height`
  - Rotate: update `rotation`

- **Rectangles / Circles** (`rectangle`, `circle`):
  - Select + resize + rotate
  - Circle storage is bbox-style; resizing updates `width`/`height` like a rect

- **Line** (`line`):
  - Select: highlight
  - Transform: either (a) disallow resize/rotate for MVP, or (b) implement endpoint editing
  - Keep MVP simple if time-boxed

- **Frame** (`frame`):
  - Select: highlight
  - Resize: update `width`/`height`
  - Title position should stay consistent on resize

- **Connector** (`connector`):
  - Usually not resized directly; endpoints recompute from connected objects
  - Selection highlight is fine (no transformer)

### UX expectations
- Selecting an object shows a clear selection state (border/halo)
- Transformer handles don’t interfere with pan/zoom
- Dragging a selected object still works (existing behavior)
- Resizing keeps min sizes to avoid negative or tiny dimensions
- Rotating snaps can be omitted for MVP

---

## Technical Notes / Constraints

- Yjs is the source of truth; selection state stays local (React/Zustand), but geometry updates must go to Yjs.
- Konva Transformer works by attaching to a Konva node via `ref`. You’ll likely need:
  - per-object refs or a lookup `Map<objectId, Konva.Node>`
  - a single Transformer that attaches to the currently selected node(s)
- Beware of coordinate conversion with pan/zoom. All stored geometry should remain in **board/canvas coordinates**, not screen coordinates.
- Avoid `any`. Use `unknown` + type guards where needed.

---

## Testing Checklist (Manual + Automated)

### Manual
1. Create each object type, select it, deselect it
2. Resize sticky/rect/circle/frame and verify it syncs to a second browser/account
3. Rotate sticky/rect/circle/frame and verify sync + persistence
4. Hard refresh: transformed geometry persists
5. Pan/zoom then transform: geometry updates correctly (no jumps)

### Automated (Vitest)
- Add/extend unit tests for `updateObject()` usage patterns if you introduce new helper functions
- If you add geometry normalization (min sizes, clamp), unit-test the pure functions

---

## Acceptance Criteria

- ✅ Click-to-select works for sticky notes + shapes + frames
- ✅ Selected objects show Transformer handles (where supported)
- ✅ Resize updates Yjs object `width/height` and syncs to other clients
- ✅ Rotate updates Yjs `rotation` and syncs to other clients
- ✅ All transforms persist across hard refresh
- ✅ No performance regressions during pan/zoom and transforms

