# TICKET-05: Multiplayer Cursors via Socket.io — Primer

**Use this to start TICKET-05 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @documentation/agents/agents.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-05: Multiplayer Cursors via Socket.io.

Current state:
- ✅ TICKET-01 is COMPLETE (auth, board CRUD, deployed)
- ✅ TICKET-02 is COMPLETE (Konva canvas with pan/zoom)
- ✅ TICKET-03 is COMPLETE (Yjs Y.Map, WebSocket provider, Socket.io, server running)
- ✅ TICKET-04 is COMPLETE (sticky notes with CRUD via Yjs)
- ✅ Socket.io infrastructure exists: lib/sync/cursor-socket.ts with helper functions
- ✅ Server handles Socket.io connections: server/src/socket-server.ts
- ✅ Canvas component initializes Socket.io connection on mount
- ✅ Connection status indicator shows Socket.io connected (green dot)
- ✅ Types defined: CursorMoveEvent in lib/sync/cursor-socket.ts

What's NOT done yet:
- ❌ No cursor movement tracking on Canvas
- ❌ No cursor event emission (no emitCursorMove calls)
- ❌ No throttling (must be 20-30Hz, not every mousemove)
- ❌ No RemoteCursor component to render other users' cursors
- ❌ No cursor state management (local state for remote cursors)
- ❌ No cursor color assignment per user
- ❌ No user name labels on cursors
- ❌ No coordinate conversion (canvas coords vs screen coords)

TICKET-05 Goal:
Implement real-time multiplayer cursors. When a user moves their mouse on the canvas, their cursor position is broadcast to all other users on the same board. Each user sees all other users' cursors with their names and unique colors. Cursor positions must be throttled to 20-30Hz to prevent network flooding.

Check @documentation/architecture/system-design.md for cursor event schema before starting.
Follow the file structure in @documentation/reference/presearch.md section 13.

After completion, follow the TICKET-05 testing checklist in @documentation/testing/TESTS.md.
```

---

## Quick Reference

**Time Budget:** 1.5 hours  
**Branch:** `feat/multiplayer-cursors` (create new branch)  
**Dependencies:** TICKET-01, TICKET-02, TICKET-03, TICKET-04 — all complete

---

## Objective

Implement real-time multiplayer cursors so users can see each other's mouse movements on the canvas. Each cursor displays the user's name and has a unique color. Cursor positions are throttled to 20-30Hz to prevent performance issues.

---

## What Already Exists (from TICKET-03)

### Socket.io Infrastructure

**`lib/sync/cursor-socket.ts`** — Socket.io client with helper functions:
```typescript
// Already implemented:
export interface CursorMoveEvent {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
}

createCursorSocket(options): Socket
emitCursorMove(socket, data): void
onCursorMove(socket, callback): void
disconnectSocket(socket): void
```

**`server/src/socket-server.ts`** — Socket.io server with auth and room management:
- JWT authentication on connection
- Room join/leave handling (`join-board`, `leave-board`)
- Broadcast infrastructure ready for `cursor:move` events

**`components/board/Canvas.tsx`** — Already initializes Socket.io:
- Socket created on component mount (line ~154-170)
- Stores socket in state (line ~34)
- Connection status indicator (green dot bottom-right)
- Cleanup on unmount

---

## What to Build

### 1. `components/board/RemoteCursor.tsx` — Konva Component

A react-konva component to render other users' cursors.

**Props:**
```typescript
interface RemoteCursorProps {
  x: number;
  y: number;
  userName: string;
  color: string;
}
```

**Visual Design:**
- SVG-like pointer shape (triangle + tail)
- User name label below cursor
- Background with slight shadow for readability
- Smooth movement (no jumpy updates)

**Konva Elements:**
- `<Group>` for cursor + label
- `<Line>` or `<Path>` for pointer shape
- `<Text>` for user name
- `<Rect>` as background for text (with padding)

### 2. Cursor Tracking in Canvas

Track mouse movement on the Stage and emit cursor position events.

**Implementation:**
```typescript
// In Canvas.tsx:

// 1. Track cursor position state
const [localCursor, setLocalCursor] = useState({ x: 0, y: 0 });

// 2. Add mousemove handler to Stage
const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
  const stage = stageRef.current;
  if (!stage) return;
  
  const pointerPos = stage.getPointerPosition();
  if (!pointerPos) return;
  
  // Convert to canvas coordinates
  const canvasX = (pointerPos.x - stage.x()) / stage.scaleX();
  const canvasY = (pointerPos.y - stage.y()) / stage.scaleY();
  
  setLocalCursor({ x: canvasX, y: canvasY });
};

// 3. Add to Stage props
<Stage onMouseMove={handleMouseMove}>
```

### 3. Throttled Cursor Emission

**Critical:** Must throttle to 20-30Hz (33-50ms interval) to prevent network flooding.

**Pattern:**
```typescript
// Use useRef to track last emit time
const lastEmitTime = useRef<number>(0);
const THROTTLE_MS = 33; // ~30Hz

useEffect(() => {
  if (!socket || !session) return;
  
  const now = Date.now();
  if (now - lastEmitTime.current < THROTTLE_MS) return;
  
  lastEmitTime.current = now;
  
  emitCursorMove(socket, {
    userId: session.user.id,
    userName: session.user.email?.split('@')[0] || 'Anonymous',
    x: localCursor.x,
    y: localCursor.y,
    color: userColor, // Assign stable color per user
  });
}, [localCursor, socket, session]);
```

### 4. Remote Cursor State Management

Store and manage remote cursors in React state.

**Pattern:**
```typescript
// State for remote cursors
const [remoteCursors, setRemoteCursors] = useState<Map<string, CursorMoveEvent>>(
  new Map()
);

// Listen for cursor:move events
useEffect(() => {
  if (!socket) return;
  
  const handleRemoteCursor = (data: CursorMoveEvent) => {
    // Don't show own cursor
    if (data.userId === session?.user.id) return;
    
    setRemoteCursors((prev) => {
      const next = new Map(prev);
      next.set(data.userId, data);
      return next;
    });
  };
  
  onCursorMove(socket, handleRemoteCursor);
  
  return () => {
    socket.off('cursor:move', handleRemoteCursor);
  };
}, [socket, session]);
```

### 5. User Color Assignment

Assign a stable, unique color to each user.

**Approach 1: Hash User ID**
```typescript
function getUserColor(userId: string): string {
  const colors = [
    '#ef4444', // red
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];
  
  // Simple hash: sum char codes
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
```

**Approach 2: Store in Zustand** (optional, for persistence across component mounts)
```typescript
// Add to ui-store.ts:
userColor: string;
setUserColor: (color: string) => void;

// Initialize once per session
useEffect(() => {
  const color = getUserColor(session.user.id);
  setUserColor(color);
}, [session]);
```

### 6. Render Remote Cursors on Canvas

Render all remote cursors on a dedicated Layer (above objects, below UI).

```typescript
<Layer>
  {/* Board objects (sticky notes) */}
  {boardObjects.map(...)}
</Layer>

<Layer>
  {/* Remote cursors */}
  {Array.from(remoteCursors.values()).map((cursor) => (
    <RemoteCursor
      key={cursor.userId}
      x={cursor.x}
      y={cursor.y}
      userName={cursor.userName}
      color={cursor.color}
    />
  ))}
</Layer>
```

### 7. Cursor Cleanup (User Leaves)

Remove stale cursors when users disconnect.

**Server-side** (already handled in socket-server.ts):
- Socket.io automatically handles disconnect events
- Room cleanup on disconnect

**Client-side** (add timeout for stale cursors):
```typescript
// Remove cursor if no update for 5 seconds
useEffect(() => {
  const interval = setInterval(() => {
    const now = Date.now();
    setRemoteCursors((prev) => {
      const next = new Map(prev);
      for (const [userId, cursor] of next.entries()) {
        if (now - cursor.timestamp > 5000) {
          next.delete(userId);
        }
      }
      return next;
    });
  }, 1000);
  
  return () => clearInterval(interval);
}, []);
```

**Note:** This requires adding `timestamp` to `CursorMoveEvent`.

---

## Data Flow

```
User moves mouse on Canvas
  ↓
handleMouseMove fires (every frame ~60Hz)
  ↓
Convert screen → canvas coords
  ↓
Update localCursor state
  ↓
useEffect triggered (throttled to 33ms)
  ↓
emitCursorMove() to Socket.io
  ↓
Server broadcasts to all users in room
  ↓
Other clients receive cursor:move event
  ↓
handleRemoteCursor updates remoteCursors Map
  ↓
RemoteCursor components re-render
  ↓
Users see cursor move on canvas
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `components/board/RemoteCursor.tsx` | Konva component for rendering a single remote cursor |

## Files to Modify

| File | Changes |
|------|---------|
| `components/board/Canvas.tsx` | Add cursor tracking, throttled emission, remote cursor rendering |
| `lib/sync/cursor-socket.ts` | (Optional) Add timestamp to CursorMoveEvent type |
| `stores/ui-store.ts` | (Optional) Add userColor state if using Zustand approach |

---

## Acceptance Criteria (from PRD)

- [ ] User's cursor position is tracked on canvas
- [ ] Cursor position emitted to Socket.io (throttled to 20-30Hz)
- [ ] Remote cursors received and rendered
- [ ] Each cursor has a unique color per user
- [ ] Each cursor shows the user's name label
- [ ] Cursor coordinates converted correctly (canvas coords, not screen coords)
- [ ] No "echo" — user doesn't see their own cursor
- [ ] Smooth cursor movement (no jumpy updates)
- [ ] Cursors disappear when users leave (< 5 sec delay)
- [ ] All of the above work in a second browser tab

---

## Technical Gotchas

### 1. Coordinate Conversion

Cursor events give **screen coordinates**. You must convert to **canvas coordinates** (accounting for pan/zoom):

```typescript
const canvasX = (screenX - stage.x()) / stage.scaleX();
const canvasY = (screenY - stage.y()) / stage.scaleY();
```

### 2. Throttling is Critical

**DO NOT** emit cursor events on every `mousemove` (fires at 60Hz). This will flood the network and cause performance issues.

**Always throttle to 20-30Hz (33-50ms interval).**

Use `useRef` to track last emit time, not state (state updates are async).

### 3. Don't Show Own Cursor

When receiving `cursor:move` events, filter out events where `userId === session.user.id`. Otherwise, users will see an echo of their own cursor.

### 4. Cursor Positioning on Zoomed Canvas

Remote cursors are rendered in **canvas coordinates** (not screen coordinates). Konva automatically handles the transform when you place them in a Layer with the Stage's transform applied.

Just render at `x` and `y` directly — no manual transform needed.

### 5. Cursor Layer Z-Index

Remote cursors should be above board objects but below UI elements (toolbar, color picker, etc.).

Order in Konva:
1. Grid layer (bottom)
2. Objects layer (sticky notes)
3. **Cursors layer** ← Add this
4. HTML overlays (TextEditor, ColorPicker) — not in Konva

### 6. User Name Extraction

User emails from Supabase look like `user@example.com`. Extract just the name part:

```typescript
const userName = session.user.email?.split('@')[0] || 'Anonymous';
```

Or use `session.user.user_metadata.display_name` if available.

### 7. Cursor Cleanup

Cursors don't automatically disappear when users close their browser. Options:

- **Timeout approach:** Remove if no update for 5 seconds
- **Server disconnect event:** Emit `cursor:leave` on disconnect (requires server change)

For TICKET-05, timeout approach is sufficient.

---

## Architecture Rules (Non-Negotiable)

1. **Socket.io for cursors only** — never send board objects through Socket.io (use Yjs)
2. **Throttle to 20-30Hz** — never emit on every mousemove
3. **Canvas coordinates** — always convert screen → canvas coords before emitting
4. **Ephemeral data** — cursor positions are never persisted to database
5. **No echo** — user must not see their own cursor as a remote cursor

---

## Testing Strategy

### Vitest Unit Tests (Optional for TICKET-05)

Cursor logic is mostly integration-level. Unit tests could cover:
- `getUserColor()` function (deterministic hash)
- Throttle logic (mock timers)
- Coordinate conversion formula

**Priority:** Low (manual testing more valuable here)

### Manual Testing Checklist

**Single Browser:**
- [ ] Move mouse on canvas → no errors in console
- [ ] Check browser DevTools Network tab → `cursor:move` events throttled (~30Hz)

**Multi-Browser (Critical):**
- [ ] Open 2 browsers to same board (or Chrome + Incognito)
- [ ] Move mouse in Browser A → cursor appears in Browser B
- [ ] Cursor has user name label
- [ ] Cursor has unique color (different per user)
- [ ] Cursor position updates smoothly (not jumpy)
- [ ] No "echo" — don't see own cursor in same browser
- [ ] Zoom/pan in Browser B → cursor position still correct
- [ ] Close Browser A → cursor disappears in Browser B (< 5 sec)

### Playwright E2E Tests (Add Later if Time)

```typescript
test('cursor movement syncs between browsers', async ({ browser }) => {
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();
  
  await page1.goto('/board/123');
  await page2.goto('/board/123');
  
  await page1.mouse.move(300, 300);
  
  // Verify remote cursor appears in page2
  await expect(page2.locator('.remote-cursor')).toBeVisible();
  
  // Verify position, name label, no echo
});
```

---

## Server-Side Changes (Probably None Needed)

The Socket.io server already handles:
- ✅ Authentication
- ✅ Room join/leave
- ✅ Broadcast to room

**Broadcast logic** (already in `server/src/socket-server.ts`):
```typescript
socket.on('cursor:move', (data) => {
  socket.to(currentRoom).emit('cursor:move', data);
});
```

This broadcasts to **everyone except sender** (using `socket.to()`), so no echo by default.

**Verify this exists.** If not, add it.

---

## Suggested Implementation Order

1. **Create `RemoteCursor.tsx`** — Konva component (visual only, hardcode props for testing)
2. **Add cursor tracking** — `onMouseMove` handler in Canvas, convert coords
3. **Add throttled emission** — useEffect with throttle logic, emit to Socket.io
4. **Add user color assignment** — Hash function or Zustand store
5. **Add remote cursor state** — useState with Map, listen for `cursor:move`
6. **Render remote cursors** — Add Layer with RemoteCursor components
7. **Test multi-browser** — Open 2 tabs, verify sync
8. **Add cursor cleanup** — Timeout for stale cursors
9. **Polish** — Smooth animations, better visual design

---

## Environment Reminder

**Client dev server:** `npm run dev` (port 3000)  
**WebSocket server:** `cd server && npm run dev` (port 4000)  
**Both must be running** for cursor sync to work.

**Test:** Open `http://localhost:3000` in 2 browser tabs (or Chrome + Incognito)

---

## Prompt Seed

> Read `@documentation/agents/agents.md` and `@documentation/architecture/system-design.md`. I'm working on TICKET-05: Multiplayer Cursors via Socket.io. Start a new branch `feat/multiplayer-cursors`. Socket.io is already connected in Canvas.tsx. Create a `RemoteCursor.tsx` Konva component. Track mouse movement on Stage with `onMouseMove`, convert screen → canvas coords. Throttle cursor emission to 20-30Hz using `useRef` for last emit time. Listen for `cursor:move` events and store in React state (Map by userId). Render RemoteCursor for each remote user (filter out own cursor). Assign unique color per user via hash function. Do NOT emit on every mousemove — must throttle. Test with 2 browser tabs.

---

## Bonus: Cursor Smoothing (Optional)

For extra smooth cursor movement, interpolate between positions instead of jumping:

```typescript
// In RemoteCursor.tsx, use react-spring or Konva.Animation
import { Spring } from 'react-konva';

// Or manual interpolation:
useEffect(() => {
  const anim = new Konva.Animation((frame) => {
    // Lerp toward target position
    const lerpFactor = 0.2;
    groupRef.current.x(lerp(groupRef.current.x(), targetX, lerpFactor));
    groupRef.current.y(lerp(groupRef.current.y(), targetY, lerpFactor));
  });
  anim.start();
  return () => anim.stop();
}, [targetX, targetY]);
```

**Priority:** Low (only if time permits)
