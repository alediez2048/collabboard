# TICKET-04: Sticky Note CRUD via Yjs — Primer

**Use this to start TICKET-04 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @documentation/agents/agents.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-04: Sticky Note CRUD via Yjs.

Current state:
- ✅ TICKET-01 is COMPLETE (auth, board CRUD, deployed)
- ✅ TICKET-02 is COMPLETE (Konva canvas with pan/zoom)
- ✅ TICKET-03 is COMPLETE (Yjs Y.Map, WebSocket provider, Socket.io, server running)
- ✅ Yjs infrastructure exists: lib/yjs/board-doc.ts with typed helpers (addObject, updateObject, removeObject, getAllObjects)
- ✅ WebSocket server exists: server/src/index.ts with y-websocket + Socket.io on port 4000
- ✅ Canvas component initializes Y.Doc and WebsocketProvider on mount
- ✅ Connection status indicators show Yjs + Socket.io connected (green dots)
- ✅ Integration tests passing: tests/integration/yjs-sync.test.ts (9/9 tests)

What's NOT done yet:
- ❌ No board objects rendered on canvas (empty Layer at line 256 in Canvas.tsx)
- ❌ No StickyNote component
- ❌ No Y.Map observer in Canvas (no reactive rendering from Yjs)
- ❌ No click-to-create interaction
- ❌ No text editing (no HTML textarea overlay)
- ❌ No color picker
- ❌ No delete functionality

TICKET-04 Goal:
Implement the first interactive board object: sticky notes. Users can create, move, edit text, change color, and delete sticky notes. All operations write to the Yjs Y.Map — Yjs handles real-time sync automatically.

Check @documentation/architecture/system-design.md for data flow architecture before starting.
Follow the file structure in @documentation/reference/presearch.md section 13.

After completion, follow the TICKET-04 testing checklist in @documentation/testing/TESTS.md.
```

---

## Quick Reference

**Time Budget:** 2.5 hours  
**Branch:** `feat/sticky-notes` ✅ (already created)  
**Dependencies:** TICKET-01 (auth), TICKET-02 (canvas), TICKET-03 (Yjs + Socket.io) — all complete

---

## Objective

Implement the first interactive board object: sticky notes. Users can create, move, edit text, change color, and delete sticky notes. All operations write to the Yjs `Y.Map` — Yjs handles real-time sync to other connected clients automatically.

---

## What Already Exists (from TICKET-01–03)

### Yjs Infrastructure (TICKET-03)

**`lib/yjs/board-doc.ts`** — Y.Doc with typed helpers:
```typescript
// Types
interface BoardObject {
  id: string;
  type: BoardObjectType; // 'sticky_note' | 'rectangle' | 'circle' | ...
  x: number; y: number;
  width: number; height: number;
  rotation: number; zIndex: number;
  properties: Record<string, unknown>; // { text, color, fontSize, ... }
  createdBy: string;
  updatedAt: string; // ISO timestamp
}

// Helpers already implemented:
createBoardDoc(): { doc: Y.Doc, objects: Y.Map<BoardObject> }
addObject(objects, boardObject): void
updateObject(objects, objectId, partialUpdates): void
removeObject(objects, objectId): void
getAllObjects(objects): BoardObject[]
getObject(objects, objectId): BoardObject | undefined
```

**`lib/yjs/provider.ts`** — WebsocketProvider that connects to `ws://localhost:4000/yjs` with JWT auth.

**`lib/sync/cursor-socket.ts`** — Socket.io client for cursor broadcast (used in TICKET-05, not this ticket).

### Canvas (TICKET-02)

**`components/board/Canvas.tsx`** — Full-viewport Konva Stage with:
- Pan (drag) and zoom (mouse wheel)
- Grid background layer
- Empty `<Layer>` ready for board objects (line 256)
- Already initializes `Y.Doc` and `WebsocketProvider` on mount
- Stores `yDoc` in state (currently unused, will be used here)
- Connection status indicators (Yjs + Socket.io green dots)

**`components/board/Toolbar.tsx`** — Tool buttons including `sticky` tool (visual only, no functionality yet).

**`stores/ui-store.ts`** — Zustand store with `selectedTool` state (includes `'sticky'` option).

### Server (TICKET-03)

**`server/src/index.ts`** — Express + y-websocket + Socket.io on port 4000.  
Uses `noServer: true` with manual upgrade routing for `/yjs/{roomName}` prefix matching.

---

## What to Build

### 1. `components/board/StickyNote.tsx` — Konva Component

A react-konva `<Group>` containing:
- `<Rect>` — colored background (default 200x200, rounded corners)
- `<Text>` — editable text content (word-wrapped, padded)

**Props:**
```typescript
interface StickyNoteProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
}
```

**Behavior:**
- Click to select (blue border when selected)
- Drag to move (updates position on drag end)
- Double-click to enter text editing mode
- Visual: colored rectangle with text, slight shadow for depth

### 2. Text Editing — HTML Overlay

Konva doesn't support native text input. The standard pattern is:
1. Double-click a sticky note → hide the Konva `<Text>`
2. Show an HTML `<textarea>` positioned exactly over the Konva node
3. On blur or Enter → update the Yjs map, hide the textarea, show the Konva `<Text>` again

**Important:** The textarea must account for canvas pan/zoom to position correctly. Use the Stage's `getAbsoluteTransform()` to convert canvas coordinates to screen coordinates.

### 3. Canvas Integration — Observe Y.Map

In `Canvas.tsx`:
- Get the `objects` Y.Map from the Y.Doc
- Use `objects.observe()` to listen for changes (add, update, delete)
- Maintain a React state array of `BoardObject[]` derived from the Y.Map
- Render a `<StickyNote>` for each object with `type === 'sticky_note'`

**Pattern for reactive Yjs → React:**
```typescript
useEffect(() => {
  if (!yDoc) return;
  const objects = yDoc.getMap<BoardObject>('objects');
  
  const observer = () => {
    const allObjects = getAllObjects(objects);
    setBoardObjects(allObjects);
  };
  
  objects.observe(observer);
  // Initial load
  observer();
  
  return () => objects.unobserve(observer);
}, [yDoc]);
```

### 4. Toolbar — "Sticky Note" Tool Activation

When `selectedTool === 'sticky'`:
- Clicking on the canvas creates a new sticky note at the click position
- Must convert screen coordinates to canvas coordinates (account for pan/zoom)
- After creation, switch back to `'select'` tool

**Coordinate conversion:**
```typescript
const stage = stageRef.current;
const pointerPos = stage.getPointerPosition(); // screen coords
const canvasX = (pointerPos.x - stage.x()) / stage.scaleX();
const canvasY = (pointerPos.y - stage.y()) / stage.scaleY();
```

### 5. Color Picker

A simple color picker UI that appears when a sticky note is selected:
- At least 6 colors: yellow, pink, blue, green, orange, purple
- Clicking a color updates `properties.color` in the Yjs map
- Can be a floating palette near the selected note, or in a toolbar/sidebar

**Suggested colors:**
```typescript
const STICKY_COLORS = [
  '#ffeb3b', // yellow (default)
  '#f48fb1', // pink
  '#90caf9', // blue
  '#a5d6a7', // green
  '#ffcc80', // orange
  '#ce93d8', // purple
];
```

### 6. Delete

- When a sticky note is selected, pressing `Backspace` or `Delete` removes it
- Calls `removeObject(objects, selectedId)` on the Yjs map
- Must add a `keydown` event listener (on `window` or the Stage)

---

## Data Flow

```
User clicks canvas (sticky tool active)
  → Convert screen coords to canvas coords
  → Generate UUID for new object
  → Call addObject(objects, { id, type: 'sticky_note', x, y, ... })
  → Yjs Y.Map fires observe event
  → React state updates → StickyNote renders on canvas
  → Yjs syncs to server → server relays to other clients
  → Other clients' Y.Map fires observe → their React state updates → they see the note
```

**Critical rule:** NEVER store board objects in React state independently of Yjs. The Y.Map is the single source of truth. React state is a derived view that re-syncs on every Y.Map observe event.

---

## Files to Create

| File | Purpose |
|------|---------|
| `components/board/StickyNote.tsx` | Konva Group (Rect + Text) for a single sticky note |
| `components/board/TextEditor.tsx` | HTML textarea overlay for inline text editing |
| `components/board/ColorPicker.tsx` | Floating color palette for changing sticky note color |

## Files to Modify

| File | Changes |
|------|---------|
| `components/board/Canvas.tsx` | Add Y.Map observer, render StickyNote components, handle click-to-create, handle delete, manage selected object state |
| `components/board/Toolbar.tsx` | No changes needed (tool buttons already exist and set `selectedTool`) |
| `stores/ui-store.ts` | Possibly add `selectedObjectId` state (or keep it local to Canvas) |

---

## Acceptance Criteria (from PRD)

- [ ] User can create a sticky note by clicking on the canvas (with sticky tool selected)
- [ ] User can drag the sticky note to move it
- [ ] User can double-click to edit the text
- [ ] User can change the sticky note color
- [ ] User can delete a sticky note (select + Backspace/Delete)
- [ ] All of the above appear instantly on a second browser tab
- [ ] Write a Vitest unit test: create object in Y.Map, verify properties, simulate remote update, verify local Y.Map reflects it

---

## Tests to Write

### Vitest Unit Tests (`tests/unit/sticky-note.test.ts`)

1. **Create sticky note in Y.Map** — verify all properties set correctly
2. **Update sticky note position** — verify x/y change in Y.Map
3. **Update sticky note text** — verify properties.text changes
4. **Update sticky note color** — verify properties.color changes
5. **Delete sticky note** — verify removed from Y.Map
6. **Remote update reflected** — create in doc1, sync to doc2, update in doc2, sync back, verify doc1 has update

### Manual Testing Checklist

- [ ] Click "Sticky Note" tool, click canvas → note appears
- [ ] Drag note → it moves smoothly
- [ ] Double-click note → textarea appears, type text, click away → text saved
- [ ] Select note → click color → color changes
- [ ] Select note → press Delete → note disappears
- [ ] Open second browser tab → all operations sync in real-time
- [ ] Create note in tab A → appears in tab B
- [ ] Move note in tab B → moves in tab A
- [ ] Edit text in tab A → text updates in tab B
- [ ] Delete in tab B → disappears in tab A

---

## Technical Gotchas

### 1. Konva Text Editing
Konva has no native text input. You MUST use an HTML overlay. The `konva` docs recommend creating a `<textarea>` positioned absolutely over the canvas. See: https://konvajs.org/docs/sandbox/Editable_Text.html

### 2. Coordinate Conversion
When the user clicks the canvas to place a sticky note, the click position is in **screen coordinates**. You must convert to **canvas coordinates** accounting for pan and zoom:
```typescript
const canvasX = (screenX - stage.x()) / stage.scaleX();
const canvasY = (screenY - stage.y()) / stage.scaleY();
```

### 3. Y.Map Observe vs. ObserveDeep
- `objects.observe(callback)` fires when keys are added/removed/updated at the top level
- This is sufficient since each BoardObject is stored as a single value (not nested Y types)
- Do NOT use `observeDeep` — it's unnecessary and slower

### 4. Stage Draggable vs. Object Draggable
The Stage is `draggable` for panning. Individual sticky notes are also `draggable` for moving. You need to prevent the Stage from panning when dragging a sticky note:
```typescript
// On StickyNote drag start:
stage.draggable(false); // Temporarily disable stage drag

// On StickyNote drag end:
stage.draggable(true); // Re-enable stage drag
```

Or alternatively, only make the Stage draggable when the `select` tool is active and no object is being dragged.

### 5. UUID Generation
Use `crypto.randomUUID()` for generating object IDs. It's available in all modern browsers and Node.js.

### 6. User ID for `createdBy`
Get the current user's ID from the Supabase session:
```typescript
const supabase = createClient();
const { data: { session } } = await supabase.auth.getSession();
const userId = session?.user?.id;
```

### 7. React Strict Mode Double-Mount
React 18+ in development mode double-mounts components. The Y.Map observer setup/teardown in `useEffect` must be idempotent. Always return a cleanup function that calls `objects.unobserve(observer)`.

### 8. Preventing Click-Through on UI Elements
When clicking the color picker or other UI overlays, the click should NOT create a new sticky note on the canvas. Check `e.target` to ensure clicks are on the Stage/Layer, not on existing objects or UI elements.

---

## Architecture Rules (Non-Negotiable)

1. **Yjs Y.Map is the single source of truth** — never store board objects in Zustand or standalone React state
2. **All mutations go through Yjs helpers** — `addObject()`, `updateObject()`, `removeObject()`
3. **React state is a derived view** — re-computed on every Y.Map observe event
4. **No direct Supabase writes** — persistence is handled by the server in TICKET-07
5. **Zustand is for UI state only** — `selectedTool`, `zoom`, `pan`, optionally `selectedObjectId`

---

## Suggested Implementation Order

1. **Write tests first** (TDD per workspace rules)
2. **Create `StickyNote.tsx`** — static Konva component (no Yjs yet)
3. **Wire up Y.Map observer in Canvas** — render StickyNote from Yjs data
4. **Implement click-to-create** — sticky tool + coordinate conversion
5. **Implement drag-to-move** — update Yjs on drag end
6. **Implement text editing** — HTML textarea overlay
7. **Implement color picker** — floating palette
8. **Implement delete** — keydown listener
9. **Test real-time sync** — two browser tabs
10. **Clean up and verify** — lint, build, all tests pass

---

## Environment Reminder

**Client dev server:** `npm run dev` (port 3000)  
**WebSocket server:** `cd server && npm run dev` (port 4000)  
**Both must be running** for real-time sync to work.

**Test:** `npx vitest run`  
**Build:** `npm run build`  
**Lint:** `npx eslint . --fix`

---

## Prompt Seed

> Read `@documentation/agents/agents.md` and `@documentation/architecture/system-design.md`. I'm working on TICKET-04: Sticky Note CRUD via Yjs. Start a new branch `feat/sticky-notes`. The Yjs Y.Map in `lib/yjs/board-doc.ts` is the single source of truth. Create a `StickyNote.tsx` react-konva component. Observe the Y.Map for changes and render a Konva Group (Rect + Text) for each entry. Creation, move, edit, and delete all write to the Y.Map — Yjs handles sync. Do NOT write to Supabase directly. Do NOT store objects in Zustand. Follow TDD — write tests first.
