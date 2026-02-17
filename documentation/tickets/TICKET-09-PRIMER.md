# TICKET-09: Connectors + Frames — Primer

**Use this to start TICKET-09 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @documentation/agents/agents.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-09: Connectors + Frames.

Current state:
- ✅ TICKET-01 through TICKET-08 are all COMPLETE
- ✅ Canvas.tsx renders sticky notes + shapes (rect, circle, line) from Yjs Y.Map
- ✅ BoardObjectType includes 'connector' | 'frame' already in lib/yjs/board-doc.ts
- ✅ Toolbar has all tool stubs — need to add 'connector' and 'frame' tool buttons
- ✅ Shapes use drag-to-draw pattern; sticky notes use click-to-place pattern
- ✅ All objects write to the same Yjs Y.Map via addObject/updateObject in lib/yjs/board-doc.ts
- ✅ Persistence is automatic — new objects auto-save via TICKET-07 snapshot mechanism

What's NOT done yet:
- ❌ No Connector.tsx component
- ❌ No Frame.tsx component
- ❌ Connector/frame tools not in Toolbar
- ❌ No connector draw interaction in Canvas.tsx
- ❌ No frame draw/edit interaction in Canvas.tsx

TICKET-09 Goal:
Add connectors (arrows between two board objects) and frames (labeled rectangular
regions for grouping). Connectors store the IDs of their start and end objects and
recompute endpoints reactively when those objects move. Frames are drawn by
drag-to-draw (like shapes) and have an editable title. Both write to the same Yjs
Y.Map and sync to all connected clients automatically.

Check @components/board/Canvas.tsx for the existing shape/sticky-note patterns.
Check @components/board/Shape.tsx for the Konva component pattern to follow.
Check @lib/yjs/board-doc.ts for the BoardObject type.
After completion, follow the TICKET-09 testing checklist.
```

---

## Quick Reference

**Time Budget:** 2.5 hours  
**Branch:** `feat/connectors-frames` (create from `main`)  
**Dependencies:** TICKET-08 (drag-to-draw pattern, Shape.tsx as template)

---

## Objective

Add two new object types:
1. **Connector** — an arrow drawn between two existing objects. Endpoints track the center of each connected object and update live as those objects are moved.
2. **Frame** — a labeled rectangular region drawn by drag. Title is editable inline. Objects inside move with the frame when it's dragged.

---

## What Already Exists

### BoardObject Type (already has connector + frame)

**`lib/yjs/board-doc.ts`:**
```typescript
export type BoardObjectType =
  | 'sticky_note' | 'rectangle' | 'circle' | 'line'
  | 'connector'   // ← already in union
  | 'frame'       // ← already in union
  | 'text';
```

### Shape Properties Pattern

Connectors and frames use `BoardObject.properties: Record<string, unknown>` for their extra fields.

**Connector properties:**
```typescript
properties: {
  fromId: string;     // ID of the start object
  toId: string;       // ID of the end object
  color: string;      // arrow color
  strokeWidth: number;
}
// x, y, width, height are unused for connectors (endpoints computed from objects)
```

**Frame properties:**
```typescript
properties: {
  title: string;      // editable label
  fillColor: string;  // semi-transparent fill
  strokeColor: string;
}
// x, y, width, height define the frame region
```

---

## What to Build

### 1. `components/board/Connector.tsx`

A Konva arrow between two objects. Reads `fromId` and `toId` from props, finds those objects in `boardObjects`, and draws an arrow from center-to-center.

```typescript
interface ConnectorProps {
  id: string;
  fromId: string;
  toId: string;
  color: string;
  strokeWidth: number;
  boardObjects: BoardObject[];   // pass full list so endpoints are reactive
  isSelected: boolean;
  onSelect: (id: string) => void;
}
```

**Key implementation details:**
- Use react-konva `<Arrow>` (from `react-konva`) with `points={[x1, y1, x2, y2]}`
- Compute center of each object: `cx = obj.x + obj.width / 2`, `cy = obj.y + obj.height / 2`
- For lines, use `obj.x` / `obj.y` as start and `obj.properties.x2` / `obj.properties.y2` as end, then take midpoint
- If either object is missing (deleted), render nothing (`return null`)
- Wide transparent hit area (same trick as Line in Shape.tsx) for easy clicking
- Selection: change arrow color to `#2563eb` when `isSelected`
- Connector is **not draggable** directly — it moves when its connected objects move

```tsx
import { Arrow, Line as KonvaLine } from 'react-konva';

// In render:
const fromObj = boardObjects.find((o) => o.id === fromId);
const toObj = boardObjects.find((o) => o.id === toId);
if (!fromObj || !toObj) return null;

const x1 = fromObj.x + fromObj.width / 2;
const y1 = fromObj.y + fromObj.height / 2;
const x2 = toObj.x + toObj.width / 2;
const y2 = toObj.y + toObj.height / 2;
```

### 2. `components/board/Frame.tsx`

A labeled rectangular region. Drawn like shapes but renders a semi-transparent fill, a border, and an editable title at the top.

```typescript
interface FrameProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  fillColor: string;
  strokeColor: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
}
```

**Key implementation details:**
- `<Rect>` with semi-transparent fill (e.g. `rgba(219, 234, 254, 0.25)`) and a solid border
- `<Text>` at the top of the frame showing the title (e.g. `y={-24}` above the rect)
- Draggable Group (same pattern as StickyNote — disable stage pan on dragstart)
- Double-click opens text editing (reuse existing TextEditor overlay pattern)
- Frame is rendered **below** other objects (z-order: frames → shapes → sticky notes)

```tsx
<Group x={x} y={y} draggable onClick={() => onSelect(id)} onDblClick={() => onDoubleClick(id)} ...>
  {/* Title label above the frame */}
  <Text text={title || 'Frame'} x={0} y={-28} fontSize={13} fill="#1e40af" fontStyle="bold" />
  {/* Frame border + fill */}
  <Rect
    width={width} height={height}
    fill={fillColor}
    stroke={isSelected ? '#2563eb' : strokeColor}
    strokeWidth={isSelected ? 3 : 2}
    dash={[8, 4]}
    cornerRadius={6}
  />
</Group>
```

### 3. Draw Interactions in `Canvas.tsx`

**Connector tool — two-click draw:**

Connector creation requires clicking two existing objects (not drag). Track first-click state:

```typescript
const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
```

When `selectedTool === 'connector'`:
- First click on an object → store its ID in `connectingFrom`, highlight it
- Second click on a different object → create the connector in Yjs, clear state
- Click on empty canvas → cancel (`setConnectingFrom(null)`)

```typescript
const handleConnectorObjectClick = (objectId: string): void => {
  if (selectedTool !== 'connector') return;
  if (!connectingFrom) {
    setConnectingFrom(objectId);
  } else if (connectingFrom !== objectId) {
    // Create connector
    const connector: BoardObject = {
      id: crypto.randomUUID(),
      type: 'connector',
      x: 0, y: 0, width: 0, height: 0,
      rotation: 0,
      zIndex: boardObjects.length + 1,
      properties: {
        fromId: connectingFrom,
        toId: objectId,
        color: '#1d4ed8',
        strokeWidth: 2,
      },
      createdBy: sessionUserIdRef.current,
      updatedAt: new Date().toISOString(),
    };
    const objects = yDoc!.getMap<BoardObject>('objects');
    addObject(objects, connector);
    setConnectingFrom(null);
    setSelectedTool('select');
  }
};
```

**Frame tool — drag-to-draw (same as shapes):**

Reuse the existing `drawingShape` / `handleMouseDown` / `handleMouseUp` pattern. Add `'frame'` as a handled tool type in the draw handlers. Frame creation in `handleMouseUp`:

```typescript
// In handleMouseUp, add 'frame' alongside shape types:
const newFrame: BoardObject = {
  id: crypto.randomUUID(),
  type: 'frame',
  x, y, width, height,
  rotation: 0,
  zIndex: 0, // frames go below everything
  properties: { title: 'Frame', fillColor: 'rgba(219,234,254,0.25)', strokeColor: '#3b82f6' },
  createdBy: sessionUserIdRef.current,
  updatedAt: new Date().toISOString(),
};
```

### 4. Toolbar — Add Connector and Frame Tools

Update `components/board/Toolbar.tsx`:

```typescript
const tools = [
  { id: 'select',    label: 'Select',    icon: '⌃' },
  { id: 'sticky',    label: 'Sticky',    icon: '📝' },
  { id: 'rectangle', label: 'Rectangle', icon: '▭' },
  { id: 'circle',    label: 'Circle',    icon: '○' },
  { id: 'line',      label: 'Line',      icon: '╱' },
  { id: 'connector', label: 'Connector', icon: '↗' },  // ← new
  { id: 'frame',     label: 'Frame',     icon: '⬚' },  // ← new
  { id: 'text',      label: 'Text',      icon: 'T' },
] as const;
```

Also update the `selectedTool` type in `stores/ui-store.ts` to include `'connector'` and `'frame'`.

### 5. Render Order in Canvas Layer

Render in this z-order (bottom to top):

```tsx
<Layer>
  {/* 1. Frames (bottom — behind everything) */}
  {boardObjects.filter((o) => o.type === 'frame').map(...)}

  {/* 2. Connectors (above frames, below shapes) */}
  {boardObjects.filter((o) => o.type === 'connector').map(...)}

  {/* 3. Shapes */}
  {boardObjects.filter((o) => ['rectangle','circle','line'].includes(o.type)).map(...)}

  {/* 4. Ghost preview */}
  {drawingShape && <Shape id="__preview__" ... />}

  {/* 5. Sticky notes (top) */}
  {boardObjects.filter((o) => o.type === 'sticky_note').map(...)}
</Layer>
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `components/board/Connector.tsx` | Arrow between two objects, reactive endpoints |
| `components/board/Frame.tsx` | Labeled draggable region |
| `tests/unit/connectors-frames.test.ts` | Unit tests for connector + frame Yjs CRUD |

## Files to Modify

| File | Changes |
|------|---------|
| `components/board/Canvas.tsx` | connectingFrom state, connector click handler, frame in draw loop, render all new types |
| `components/board/Toolbar.tsx` | Add connector + frame tool buttons |
| `stores/ui-store.ts` | Add 'connector' \| 'frame' to selectedTool type |

---

## Testing Strategy

### Vitest Unit Tests — `tests/unit/connectors-frames.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createBoardDoc, addObject, getObject, updateObject, type BoardObject } from '@/lib/yjs/board-doc';

describe('Connector + Frame via Yjs', () => {
  it('creates a connector linking two object IDs', () => {
    const { objects } = createBoardDoc();
    const connector: BoardObject = {
      id: 'conn-1',
      type: 'connector',
      x: 0, y: 0, width: 0, height: 0,
      rotation: 0, zIndex: 1,
      properties: { fromId: 'obj-a', toId: 'obj-b', color: '#1d4ed8', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, connector);
    const retrieved = getObject(objects, 'conn-1');
    expect(retrieved?.type).toBe('connector');
    expect(retrieved?.properties.fromId).toBe('obj-a');
    expect(retrieved?.properties.toId).toBe('obj-b');
  });

  it('creates a frame with title and dimensions', () => {
    const { objects } = createBoardDoc();
    const frame: BoardObject = {
      id: 'frame-1',
      type: 'frame',
      x: 100, y: 100, width: 400, height: 300,
      rotation: 0, zIndex: 0,
      properties: { title: 'My Frame', fillColor: 'rgba(219,234,254,0.25)', strokeColor: '#3b82f6' },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, frame);
    const retrieved = getObject(objects, 'frame-1');
    expect(retrieved?.type).toBe('frame');
    expect(retrieved?.properties.title).toBe('My Frame');
    expect(retrieved?.width).toBe(400);
  });

  it('syncs connector between two Y.Docs', () => {
    const { doc: doc1, objects: objects1 } = createBoardDoc();
    const { doc: doc2, objects: objects2 } = createBoardDoc();
    const connector: BoardObject = {
      id: 'conn-sync',
      type: 'connector',
      x: 0, y: 0, width: 0, height: 0,
      rotation: 0, zIndex: 1,
      properties: { fromId: 'a', toId: 'b', color: '#ef4444', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects1, connector);
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));
    expect(getObject(objects2, 'conn-sync')?.properties.fromId).toBe('a');
  });

  it('updates frame title', () => {
    const { objects } = createBoardDoc();
    const frame: BoardObject = {
      id: 'frame-title',
      type: 'frame',
      x: 0, y: 0, width: 300, height: 200,
      rotation: 0, zIndex: 0,
      properties: { title: 'Old Title', fillColor: 'rgba(219,234,254,0.25)', strokeColor: '#3b82f6' },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, frame);
    updateObject(objects, 'frame-title', { properties: { title: 'New Title', fillColor: 'rgba(219,234,254,0.25)', strokeColor: '#3b82f6' } });
    expect(getObject(objects, 'frame-title')?.properties.title).toBe('New Title');
  });
});
```

### Manual Testing Checklist

**Connector:**
- [ ] Select connector tool → click object A → it highlights as "connecting from"
- [ ] Click object B → arrow appears between them
- [ ] Move object A or B → arrow endpoints update in real-time
- [ ] Connector syncs to second browser tab
- [ ] Delete a connected object → connector disappears (no orphan)
- [ ] Click on connector → selects it, Delete key removes it

**Frame:**
- [ ] Select frame tool → drag to draw a frame region
- [ ] Frame renders with dashed border + semi-transparent fill + title label
- [ ] Double-click frame → title becomes editable
- [ ] Drag frame → position updates in Yjs, syncs to other tab
- [ ] Objects placed on top of frame are visually inside it

**Persistence:**
- [ ] Draw connectors + frames → close browser → reopen → both survive

---

## Technical Gotchas

### 1. Connector endpoint computation is purely derived — never stored in Yjs

The `x1, y1, x2, y2` of a connector are computed from the current positions of `fromId` and `toId` objects at render time. They are NOT stored in the Yjs document. This means:
- Connector endpoints automatically update when connected objects are dragged
- No need to observe connector state independently — it re-renders whenever `boardObjects` changes

### 2. Connector `boardObjects` prop must be the full reactive array

Pass the full `boardObjects` array from Canvas state to `<Connector>`. Since `boardObjects` is derived from the Yjs Y.Map observer, it updates whenever any object moves — this is what makes connector endpoints track movement.

### 3. Connector click handling conflicts with object selection

When `selectedTool === 'connector'`, clicking an object should START the connection, not SELECT the object. Guard `handleSelectObject` to skip when connector tool is active:

```typescript
const handleSelectObject = (id: string): void => {
  if (selectedTool === 'connector') {
    handleConnectorObjectClick(id);
    return;
  }
  // ... normal selection
};
```

### 4. ui-store.ts selectedTool type

The Zustand store's `selectedTool` type must include `'connector'` and `'frame'` or TypeScript will complain. Check `stores/ui-store.ts` and update the type union.

### 5. Frame z-index

Set `zIndex: 0` on frames so they render below all other objects. In Canvas, render frames first in the Layer so they appear behind shapes and sticky notes.

### 6. Deleting a connected object should remove its connector

In the keyboard delete handler in Canvas.tsx, after removing an object, also scan for connectors that reference it:

```typescript
// After removeObject(objects, selectedObjectId):
objects.forEach((obj, key) => {
  if (obj.type === 'connector' &&
     (obj.properties.fromId === selectedObjectId || obj.properties.toId === selectedObjectId)) {
    objects.delete(key);
  }
});
```

---

## Acceptance Criteria (from PRD)

- [ ] User can draw a connector from one object to another
- [ ] Moving a connected object updates the connector endpoints in real-time
- [ ] User can create a frame with an editable title
- [ ] Connectors and frames sync via Yjs

---

## Suggested Implementation Order

1. Write `tests/unit/connectors-frames.test.ts` — confirm tests pass (pure Yjs)
2. Update `stores/ui-store.ts` — add 'connector' | 'frame' to selectedTool
3. Update `Toolbar.tsx` — add connector + frame buttons
4. Create `components/board/Frame.tsx` — drag-and-draw rect with dashed border + title
5. Wire frame into `Canvas.tsx` draw loop (extend existing `drawingShape` / `handleMouseUp`)
6. Create `components/board/Connector.tsx` — reactive arrow between two objects
7. Wire connector tool into `Canvas.tsx` (two-click connect flow, `connectingFrom` state)
8. Add orphan-connector cleanup to delete handler
9. Test manually: draw frames, connectors, move objects, verify sync

---

## Prompt Seed

> Read `@documentation/agents/agents.md` and `@documentation/architecture/system-design.md`.
> I'm working on TICKET-09: Connectors + Frames. BoardObjectType already includes
> 'connector' and 'frame'. Create `components/board/Connector.tsx` — a react-konva Arrow
> that reads fromId/toId from props, finds those objects in boardObjects, and draws an
> arrow center-to-center. Endpoints are purely computed (never stored in Yjs). Create
> `components/board/Frame.tsx` — a draggable dashed-border Rect with an editable title
> rendered above the frame. In Canvas.tsx, add a two-click connector draw flow
> (connectingFrom state) and extend the existing drag-to-draw for frames. Add connector
> and frame buttons to Toolbar.tsx. All objects write to the same Yjs Y.Map.
