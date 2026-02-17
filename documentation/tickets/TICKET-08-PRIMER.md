# TICKET-08: Shapes (Rectangle, Circle, Line) — Primer

**Use this to start TICKET-08 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @documentation/agents/agents.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-08: Shapes (Rectangle, Circle, Line).

Current state:
- ✅ TICKET-01 through TICKET-07 are all COMPLETE
- ✅ Canvas.tsx renders sticky notes from Yjs Y.Map
- ✅ Toolbar already has rectangle, circle, line, text tool buttons (visual stubs only)
- ✅ BoardObjectType already includes 'rectangle' | 'circle' | 'line' in lib/yjs/board-doc.ts
- ✅ BoardObject.properties is Record<string, unknown> — already flexible for shape data
- ✅ handleStageClick in Canvas.tsx already has the click-to-create pattern (for sticky notes)
- ✅ Persistence (TICKET-07) means all new shapes will auto-save to Supabase

What's NOT done yet:
- ❌ No Shape.tsx component
- ❌ Toolbar rectangle/circle/line tools do nothing when selected
- ❌ No drag-to-draw interaction in Canvas.tsx
- ❌ No shape rendering in the Layer

TICKET-08 Goal:
Add rectangle, circle, and line shapes. User selects a tool from the toolbar, then
click-and-drags on the canvas to draw the shape. Shapes write to the same Yjs Y.Map
as sticky notes and sync to all connected clients automatically. Shapes can be moved
(drag) and color-changed via the existing ColorPicker.

Check @components/board/Canvas.tsx for the existing sticky note pattern to follow.
Check @lib/yjs/board-doc.ts for the BoardObject type.
After completion, follow the TICKET-08 testing checklist.
```

---

## Quick Reference

**Time Budget:** 2 hours  
**Branch:** `feat/shapes` (create from `main`)  
**Dependencies:** TICKET-04 (sticky notes pattern), TICKET-07 (persistence — shapes auto-save)

---

## Objective

Add three shape types — rectangle, circle, line — using the exact same Yjs write pattern as sticky notes. Shapes are drawn by click-and-drag on the canvas. They sync to all clients and persist automatically via the existing snapshot mechanism.

---

## What Already Exists

### Toolbar (already has shape buttons)

**`components/board/Toolbar.tsx`:**
```typescript
const tools = [
  { id: 'select', label: 'Select', icon: '⌃' },
  { id: 'sticky', label: 'Sticky Note', icon: '📝' },
  { id: 'rectangle', label: 'Rectangle', icon: '▭' },  // ← stub exists
  { id: 'circle', label: 'Circle', icon: '○' },         // ← stub exists
  { id: 'line', label: 'Line', icon: '╱' },             // ← stub exists
  { id: 'text', label: 'Text', icon: 'T' },
] as const;
```

### BoardObject Type (already supports shapes)

**`lib/yjs/board-doc.ts`:**
```typescript
export type BoardObjectType =
  | 'sticky_note'
  | 'rectangle'   // ← already in the union
  | 'circle'      // ← already in the union
  | 'line'        // ← already in the union
  | 'connector'
  | 'frame'
  | 'text';

export interface BoardObject {
  id: string;
  type: BoardObjectType;
  x: number;       // top-left for rect/circle; start point for line
  y: number;
  width: number;   // for rect/circle; for line: 0 (use x2/y2 in properties)
  height: number;  // for rect/circle; for line: 0 (use x2/y2 in properties)
  rotation: number;
  zIndex: number;
  properties: Record<string, unknown>;  // fillColor, strokeColor, x2, y2, etc.
  createdBy: string;
  updatedAt: string;
}
```

### Yjs Write Pattern (copy from sticky notes)

```typescript
const newShape: BoardObject = {
  id: crypto.randomUUID(),
  type: 'rectangle',
  x: startX,
  y: startY,
  width: Math.abs(endX - startX),
  height: Math.abs(endY - startY),
  rotation: 0,
  zIndex: boardObjects.length + 1,
  properties: {
    fillColor: '#93c5fd',   // default light blue
    strokeColor: '#1d4ed8',
    strokeWidth: 2,
  },
  createdBy: session.user.id,
  updatedAt: new Date().toISOString(),
};

const objects = yDoc.getMap<BoardObject>('objects');
addObject(objects, newShape);
```

### Canvas Stage Event Pattern (copy from sticky notes)

`Canvas.tsx` already has:
- `stageRef` — Konva Stage ref
- `yDoc` — Y.Doc
- `boardObjects` — reactive array from Y.Map observer
- `selectedTool` — from Zustand UI store
- `sessionUserIdRef` — user ID ref (no async needed)
- Stage `onClick` handler → `handleStageClick`
- Stage `onMouseDown` handler → `handleStageMouseDown`

---

## What to Build

### 1. `components/board/Shape.tsx`

Renders a single shape based on `type`. Uses react-konva primitives.

```typescript
import { Rect, Circle, Line } from 'react-konva';

interface ShapeProps {
  id: string;
  type: 'rectangle' | 'circle' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  x2?: number;  // line endpoint
  y2?: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}
```

**Rectangle:** `<Rect>` with `width`, `height`, `fill`, `stroke`  
**Circle:** `<Circle>` — use `width/2` as `radius`, center is `(x + width/2, y + height/2)` (or use `x`/`y` directly as center)  
**Line:** `<Line points={[0, 0, x2 - x, y2 - y]}` — position the Group at `(x, y)`, points are relative  

Selection indicator: when `isSelected`, add `stroke="#2563eb"` and `strokeWidth={3}` (same pattern as StickyNote).

Disable stage dragging on shape drag start (same useEffect pattern as StickyNote).

### 2. Draw Interaction in `Canvas.tsx`

Shapes require **drag-to-draw** (not single click like sticky notes). Add:

**State:**
```typescript
const [drawingShape, setDrawingShape] = useState<{
  type: 'rectangle' | 'circle' | 'line';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
} | null>(null);
```

**Handlers** (wire to Stage `onMouseDown`, `onMouseMove`, `onMouseUp`):

```typescript
const handleShapeMouseDown = (e: KonvaEventObject<MouseEvent>): void => {
  if (!['rectangle', 'circle', 'line'].includes(selectedTool)) return;
  if (e.target !== stageRef.current) return;  // only on empty canvas

  const stage = stageRef.current!;
  const pos = stage.getPointerPosition()!;
  const canvasX = (pos.x - stage.x()) / stage.scaleX();
  const canvasY = (pos.y - stage.y()) / stage.scaleY();

  stage.draggable(false);  // disable pan while drawing
  setDrawingShape({
    type: selectedTool as 'rectangle' | 'circle' | 'line',
    startX: canvasX,
    startY: canvasY,
    currentX: canvasX,
    currentY: canvasY,
  });
};

const handleShapeMouseMove = (e: KonvaEventObject<MouseEvent>): void => {
  if (!drawingShape) return;
  const stage = stageRef.current!;
  const pos = stage.getPointerPosition()!;
  const canvasX = (pos.x - stage.x()) / stage.scaleX();
  const canvasY = (pos.y - stage.y()) / stage.scaleY();
  setDrawingShape((prev) => prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null);
};

const handleShapeMouseUp = async (): Promise<void> => {
  if (!drawingShape || !yDoc) return;

  const stage = stageRef.current!;
  stage.draggable(true);  // re-enable pan

  const { type, startX, startY, currentX, currentY } = drawingShape;
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  // Ignore tiny accidental clicks (< 5px)
  if (type !== 'line' && (width < 5 || height < 5)) {
    setDrawingShape(null);
    return;
  }

  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);

  const newShape: BoardObject = {
    id: crypto.randomUUID(),
    type,
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex: boardObjects.length + 1,
    properties:
      type === 'line'
        ? { strokeColor: '#1d4ed8', strokeWidth: 2, x2: currentX, y2: currentY }
        : { fillColor: '#93c5fd', strokeColor: '#1d4ed8', strokeWidth: 2 },
    createdBy: sessionUserIdRef.current,
    updatedAt: new Date().toISOString(),
  };

  const objects = yDoc.getMap<BoardObject>('objects');
  addObject(objects, newShape);

  setDrawingShape(null);
  setSelectedTool('select');
  setSelectedObjectId(newShape.id);
};
```

**Live preview while drawing** — render a ghost shape in the Layer while `drawingShape` is not null:

```tsx
{/* Ghost shape preview while drawing */}
{drawingShape && (
  <Shape
    id="__preview__"
    type={drawingShape.type}
    x={Math.min(drawingShape.startX, drawingShape.currentX)}
    y={Math.min(drawingShape.startY, drawingShape.currentY)}
    width={Math.abs(drawingShape.currentX - drawingShape.startX)}
    height={Math.abs(drawingShape.currentY - drawingShape.startY)}
    fillColor="rgba(147, 197, 253, 0.4)"
    strokeColor="#2563eb"
    strokeWidth={2}
    x2={drawingShape.currentX}
    y2={drawingShape.currentY}
    isSelected={false}
    onSelect={() => {}}
    onDragEnd={() => {}}
  />
)}
```

### 3. Render Shapes in Canvas Layer

In the `<Layer>` in Canvas.tsx, after sticky notes:

```tsx
{/* Render shapes */}
{boardObjects
  .filter((obj): obj is BoardObject =>
    obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'line'
  )
  .map((obj) => (
    <Shape
      key={obj.id}
      id={obj.id}
      type={obj.type as 'rectangle' | 'circle' | 'line'}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      fillColor={String(obj.properties.fillColor ?? '#93c5fd')}
      strokeColor={String(obj.properties.strokeColor ?? '#1d4ed8')}
      strokeWidth={Number(obj.properties.strokeWidth ?? 2)}
      x2={obj.properties.x2 !== undefined ? Number(obj.properties.x2) : undefined}
      y2={obj.properties.y2 !== undefined ? Number(obj.properties.y2) : undefined}
      isSelected={obj.id === selectedObjectId && !editingObjectId}
      onSelect={handleSelectObject}
      onDragEnd={handleObjectDragEnd}
    />
  ))}
```

### 4. Wire Stage Handlers

Update the `<Stage>` in Canvas.tsx:

```tsx
<Stage
  ref={stageRef}
  ...
  onMouseDown={handleMouseDown}   // merged: shape draw start + existing deselect
  onMouseMove={handleMouseMoveCanvas}  // merged: cursor emit + shape preview
  onMouseUp={handleShapeMouseUp}
  onClick={handleStageClick}      // keep existing sticky note click
  ...
>
```

Merge the existing `handleStageMouseDown` (deselect) and `handleShapeMouseDown` (draw start) into a single `handleMouseDown`:

```typescript
const handleMouseDown = (e: KonvaEventObject<MouseEvent>): void => {
  // Deselect when clicking empty canvas
  if (e.target === e.target.getStage()) {
    setSelectedObjectId(null);
    setShowColorPicker(false);
  }
  // Start drawing a shape
  handleShapeMouseDown(e);
};
```

### 5. Color Picker — Extend for Shapes

The existing `ColorPicker` and `handleColorChange` work for sticky notes (updates `properties.color`). For shapes, update `handleColorChange` to write `properties.fillColor`:

```typescript
const handleColorChange = (color: string): void => {
  if (!yDoc || !selectedObjectId) return;
  const objects = yDoc.getMap<BoardObject>('objects');
  const object = objects.get(selectedObjectId);
  if (!object) return;

  const colorKey = object.type === 'sticky_note' ? 'color' : 'fillColor';
  updateObject(objects, selectedObjectId, {
    properties: { ...object.properties, [colorKey]: color },
  });
};
```

Show the color picker for all selectable objects (not just sticky notes):

```tsx
{/* Color Picker — for sticky notes AND shapes */}
{showColorPicker && selectedObject && selectedObject.type !== 'line' && (
  <ColorPicker ... />
)}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `components/board/Shape.tsx` | Konva rect/circle/line renderer |
| `tests/unit/shapes.test.ts` | Unit tests for shape creation + Yjs sync |

## Files to Modify

| File | Changes |
|------|---------|
| `components/board/Canvas.tsx` | Add drawingShape state, mouse handlers, shape rendering, merged handleMouseDown |

---

## Shape Properties Reference

| Type | `x`, `y` | `width`, `height` | Key properties |
|------|----------|-------------------|----------------|
| `rectangle` | top-left corner | dimensions | `fillColor`, `strokeColor`, `strokeWidth` |
| `circle` | top-left of bounding box | bounding box size | `fillColor`, `strokeColor`, `strokeWidth` |
| `line` | start point | `0`, `0` (unused) | `strokeColor`, `strokeWidth`, `x2`, `y2` (endpoint) |

---

## Testing Strategy

### Vitest Unit Tests — `tests/unit/shapes.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createBoardDoc, addObject, getObject, type BoardObject } from '@/lib/yjs/board-doc';

describe('Shape CRUD via Yjs', () => {
  it('creates a rectangle with correct properties', () => {
    const { objects } = createBoardDoc();
    const rect: BoardObject = {
      id: 'rect-1',
      type: 'rectangle',
      x: 100, y: 100, width: 200, height: 150,
      rotation: 0, zIndex: 1,
      properties: { fillColor: '#93c5fd', strokeColor: '#1d4ed8', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, rect);
    const retrieved = getObject(objects, 'rect-1');
    expect(retrieved?.type).toBe('rectangle');
    expect(retrieved?.properties.fillColor).toBe('#93c5fd');
  });

  it('creates a circle with correct properties', () => {
    const { objects } = createBoardDoc();
    const circle: BoardObject = {
      id: 'circle-1',
      type: 'circle',
      x: 200, y: 200, width: 100, height: 100,
      rotation: 0, zIndex: 1,
      properties: { fillColor: '#6ee7b7', strokeColor: '#059669', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, circle);
    expect(getObject(objects, 'circle-1')?.type).toBe('circle');
  });

  it('creates a line with x2/y2 endpoint properties', () => {
    const { objects } = createBoardDoc();
    const line: BoardObject = {
      id: 'line-1',
      type: 'line',
      x: 0, y: 0, width: 0, height: 0,
      rotation: 0, zIndex: 1,
      properties: { strokeColor: '#374151', strokeWidth: 2, x2: 300, y2: 200 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, line);
    const retrieved = getObject(objects, 'line-1');
    expect(retrieved?.properties.x2).toBe(300);
    expect(retrieved?.properties.y2).toBe(200);
  });

  it('syncs shapes between two Y.Docs', () => {
    const { doc: doc1, objects: objects1 } = createBoardDoc();
    const { doc: doc2, objects: objects2 } = createBoardDoc();

    const rect: BoardObject = {
      id: 'rect-sync',
      type: 'rectangle',
      x: 50, y: 50, width: 100, height: 100,
      rotation: 0, zIndex: 1,
      properties: { fillColor: '#fde68a', strokeColor: '#d97706', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };

    addObject(objects1, rect);
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    expect(getObject(objects2, 'rect-sync')?.type).toBe('rectangle');
    expect(getObject(objects2, 'rect-sync')?.properties.fillColor).toBe('#fde68a');
  });
});
```

### Manual Testing Checklist

**Rectangle:**
- [ ] Select rectangle tool → cursor changes to crosshair (optional)
- [ ] Click-drag on canvas → rectangle appears with correct dimensions
- [ ] Release mouse → shape is committed to Yjs, tool switches back to select
- [ ] Shape appears in second browser tab immediately
- [ ] Click shape → selection border appears, color picker shows
- [ ] Change color → shape color updates in both tabs
- [ ] Drag shape → position updates in Yjs, syncs to other tab
- [ ] Select shape → press Delete → shape removed from both tabs

**Circle:**
- [ ] Same flow as rectangle — circle drawn in bounding box

**Line:**
- [ ] Click-drag draws a line from start to end point
- [ ] Line syncs to other tab
- [ ] Line can be moved (drag)
- [ ] Color picker does NOT show for lines (no fill color)

**Persistence:**
- [ ] Draw shapes → close browser → reopen board → shapes are still there

---

## Technical Gotchas

### 1. Circle centering in Konva

Konva `<Circle>` positions by its center point (`x`, `y`). To make drag behavior consistent with `<Rect>` (top-left based), either:
- Store `x`/`y` as the center and offset rendering
- Or store `x`/`y` as the bounding box top-left and compute center for Konva: `cx = x + width/2`

The second approach is simpler and consistent with how rect stores its position.

### 2. Disable pan while drawing

When the user starts drag-drawing a shape, `stage.draggable(false)` must be called. Re-enable on `mouseup`. Without this, the entire canvas pans instead of drawing.

### 3. Minimum size check

Ignore mouseup events where width/height < 5px — these are accidental clicks, not intentional draws. For lines, check that distance > 5px.

### 4. `onMouseMove` must handle both cursor emit AND shape preview

The existing `handleMouseMove` emits cursor events. Extend it (don't replace it) to also update `drawingShape.currentX/Y`.

### 5. `handleStageClick` must be guarded

The existing `handleStageClick` creates a sticky note on click. Guard it so it only fires when `selectedTool === 'sticky'` (it already does — just make sure the shape mousedown handler doesn't accidentally trigger it too).

### 6. Line `points` in Konva

Konva `<Line>` takes `points` as a flat array `[x1, y1, x2, y2, ...]`. For a simple two-point line stored with the Group at `(x, y)`, use relative points:

```tsx
<Line
  points={[0, 0, (x2 ?? x) - x, (y2 ?? y) - y]}
  stroke={strokeColor}
  strokeWidth={strokeWidth}
/>
```

---

## Acceptance Criteria (from PRD)

- [ ] User can draw a rectangle by clicking and dragging
- [ ] User can draw a circle by clicking and dragging  
- [ ] User can draw a line between two points
- [ ] Shapes sync to other browsers via Yjs
- [ ] Shapes can be moved (drag) and color-changed (except line)

---

## Suggested Implementation Order

1. Write `tests/unit/shapes.test.ts` — confirm tests fail (TDD)
2. Create `components/board/Shape.tsx` — implement Rect, Circle, Line rendering
3. Run shape unit tests — confirm they pass (they're pure Yjs, no UI needed)
4. Add `drawingShape` state + mouse handlers to `Canvas.tsx`
5. Add shape rendering in the `<Layer>` after sticky notes
6. Add ghost preview rendering for in-progress draws
7. Extend `handleColorChange` for shapes
8. Test manually: draw all three types, verify sync, verify persistence

---

## Prompt Seed

> Read `@documentation/agents/agents.md` and `@documentation/architecture/system-design.md`.
> I'm working on TICKET-08: Shapes. The toolbar in `@components/board/Toolbar.tsx` already
> has rectangle, circle, and line tool buttons. `@lib/yjs/board-doc.ts` already has
> 'rectangle' | 'circle' | 'line' in BoardObjectType. Create `components/board/Shape.tsx`
> that renders react-konva Rect, Circle, and Line based on the `type` prop. In
> `components/board/Canvas.tsx`, add drag-to-draw interaction: onMouseDown starts tracking
> start coordinates, onMouseMove updates the preview, onMouseUp commits the shape to the
> Yjs Y.Map. Shapes use the same addObject/updateObject pattern as sticky notes. Show a
> ghost preview shape while drawing. Disable Stage.draggable during draws to prevent pan.
