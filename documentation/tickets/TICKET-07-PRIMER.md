# TICKET-07: State Persistence (Yjs → Supabase) — Primer

**Use this to start TICKET-07 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @documentation/agents/agents.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-07: State Persistence (Yjs → Supabase).

Current state:
- ✅ TICKET-01 is COMPLETE (auth, board CRUD, deployed)
- ✅ TICKET-02 is COMPLETE (Konva canvas with pan/zoom)
- ✅ TICKET-03 is COMPLETE (Yjs Y.Map, WebSocket provider, Socket.io server running)
- ✅ TICKET-04 is COMPLETE (sticky notes with CRUD via Yjs)
- ✅ TICKET-05 is COMPLETE (multiplayer cursors via Socket.io, board sharing)
- ✅ TICKET-06 is COMPLETE (Yjs awareness presence bar)
- ✅ server/src/yjs-server.ts has in-memory Y.Doc storage (docs Map<string, Y.Doc>)
- ✅ server/src/auth.ts already has a Supabase client using SUPABASE_URL + SUPABASE_ANON_KEY
- ✅ Supabase project is live with boards, board_members tables
- ✅ Server env vars: SUPABASE_URL, SUPABASE_ANON_KEY already set (Railway + .env)

What's NOT done yet:
- ❌ No board_snapshots table in Supabase
- ❌ No persistence module on the server
- ❌ Y.Doc state is lost when the server restarts or all users leave
- ❌ New board loads an empty doc even if objects were created before
- ❌ No debounced snapshot saves
- ❌ No snapshot load on first client connect

TICKET-07 Goal:
Persist the Yjs board state to Supabase so that objects survive browser closes, server
restarts, and all users leaving. On each Y.Doc update, debounce a snapshot save to
Supabase (at most every 500ms). When the last user disconnects from a room, immediately
save a final snapshot. When the first user connects to a room, load the latest snapshot
from Supabase and apply it to the Y.Doc before sending the sync step.

Check @documentation/architecture/system-design.md for the persistence data flow.
After completion, follow the TICKET-07 testing checklist in @documentation/testing/TESTS.md.
```

---

## Quick Reference

**Time Budget:** 2 hours  
**Branch:** `feat/persistence` (already created from `main`)  
**Dependencies:** TICKET-01 through TICKET-06 — all complete  
**This is the last MVP ticket** — completes the hard gate for Tuesday midnight.

---

## Objective

Make board objects survive all users leaving. Right now, the server holds Y.Doc state only
in memory — a server restart or all users disconnecting wipes the board. After this ticket,
Yjs snapshots are debounced to Supabase every 500ms and loaded back on the next connection.

---

## What Already Exists

### Server In-Memory Storage (from TICKET-03)

**`server/src/yjs-server.ts`:**
```typescript
// One Y.Doc per board room, in memory only
const docs = new Map<string, Y.Doc>();

function getOrCreateDoc(roomName: string): Y.Doc {
  let doc = docs.get(roomName);
  if (!doc) {
    doc = new Y.Doc();
    docs.set(roomName, doc);
  }
  return doc;
}
```

### Supabase Client Pattern (from `server/src/auth.ts`)

The server already imports `@supabase/supabase-js` and reads `SUPABASE_URL` /
`SUPABASE_ANON_KEY` from env. For persistence writes, we need the **service role key**
(bypasses RLS) — add `SUPABASE_SERVICE_ROLE_KEY` to both `.env` and Railway env vars.

### Connection Tracking

`wss.clients` is the full set of all connected WebSocket clients across all rooms. To
count clients per room, `yjs-server.ts` will need to track a `Map<string, Set<WebSocket>>`
(room → connected clients) to detect when the last client leaves a room.

---

## What to Build

### 1. Supabase Migration — `board_snapshots` table

Create `supabase/migrations/board_snapshots.sql`:

```sql
-- TICKET-07: Board state snapshots
-- Run in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS board_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id     UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  yjs_state    BYTEA NOT NULL,
  snapshot_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT board_snapshots_board_id_unique UNIQUE (board_id)
);

-- Service role bypasses RLS — no policies needed for server-side writes.
-- Optionally enable RLS and allow only service_role:
ALTER TABLE board_snapshots ENABLE ROW LEVEL SECURITY;

-- Boards owners can read their board's snapshot (for debugging)
CREATE POLICY "snapshot_select_owner"
  ON board_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_id
        AND boards.created_by = auth.uid()
    )
  );
```

### 2. `server/src/persistence.ts`

Encapsulates all Supabase snapshot logic. **Use the service role key** so writes bypass RLS.

```typescript
import * as Y from 'yjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    serviceClient = createClient(url, key);
  }
  return serviceClient;
}

/**
 * Load the latest snapshot for a board and apply it to the Y.Doc.
 * Returns true if a snapshot was found, false if the board is new.
 */
export async function loadSnapshot(boardId: string, doc: Y.Doc): Promise<boolean> { ... }

/**
 * Save the current Y.Doc state as a snapshot for the board.
 * Uses upsert so board_id stays unique — only one snapshot row per board.
 */
export async function saveSnapshot(boardId: string, doc: Y.Doc): Promise<void> { ... }

/**
 * Returns a debounced save function (at most once every 500ms per boardId).
 * Call this for every Y.Doc update. Pass the immediate flag to save right away.
 */
export function createDebouncedSave(
  boardId: string,
  doc: Y.Doc,
  intervalMs = 500,
): { debouncedSave: () => void; cancel: () => void } { ... }
```

**`loadSnapshot` implementation:**
```typescript
export async function loadSnapshot(boardId: string, doc: Y.Doc): Promise<boolean> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('board_snapshots')
      .select('yjs_state')
      .eq('board_id', boardId)
      .single();

    if (error || !data) {
      console.log(`[Persistence] No snapshot found for board ${boardId} (new board)`);
      return false;
    }

    // yjs_state comes back as a base64 string or Buffer depending on driver
    const stateBuffer =
      typeof data.yjs_state === 'string'
        ? Buffer.from(data.yjs_state, 'base64')
        : Buffer.from(data.yjs_state);

    Y.applyUpdate(doc, new Uint8Array(stateBuffer));
    console.log(`[Persistence] Snapshot loaded for board ${boardId}`);
    return true;
  } catch (err) {
    console.error(`[Persistence] Failed to load snapshot for ${boardId}:`, err);
    return false;
  }
}
```

**`saveSnapshot` implementation:**
```typescript
export async function saveSnapshot(boardId: string, doc: Y.Doc): Promise<void> {
  try {
    const supabase = getServiceClient();
    const state = Y.encodeStateAsUpdate(doc);

    const { error } = await supabase
      .from('board_snapshots')
      .upsert(
        { board_id: boardId, yjs_state: Buffer.from(state), snapshot_at: new Date().toISOString() },
        { onConflict: 'board_id' },
      );

    if (error) throw error;
    console.log(`[Persistence] Snapshot saved for board ${boardId} (${state.length} bytes)`);
  } catch (err) {
    console.error(`[Persistence] Failed to save snapshot for ${boardId}:`, err);
  }
}
```

**`createDebouncedSave` implementation:**
```typescript
export function createDebouncedSave(
  boardId: string,
  doc: Y.Doc,
  intervalMs = 500,
): { debouncedSave: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debouncedSave = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      saveSnapshot(boardId, doc);
    }, intervalMs);
  };

  const cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return { debouncedSave, cancel };
}
```

### 3. Update `server/src/yjs-server.ts`

Three changes needed:

**A. Track connected clients per room** (to detect last-disconnect):
```typescript
// Add at module level alongside the docs/awarenessMap:
const roomClients = new Map<string, Set<WebSocket>>();
```

**B. On first client connect — load snapshot before sync:**
```typescript
// In the connection handler, after getOrCreateDoc() and before sending sync step1:
const doc = getOrCreateDoc(roomName);
const awareness = getOrCreateAwareness(roomName, doc);

// Track this client in the room
if (!roomClients.has(roomName)) {
  roomClients.set(roomName, new Set());
}
const roomSet = roomClients.get(roomName)!;
const isFirstClient = roomSet.size === 0;
roomSet.add(ws);

// Load snapshot only for the first client (doc is still empty at this point)
if (isFirstClient) {
  await loadSnapshot(roomName, doc);
  console.log(`[Yjs] First client in room ${roomName} — snapshot loaded`);
}
```

**C. On disconnect — save immediately if last client:**
```typescript
ws.on('close', () => {
  const roomSet = roomClients.get(roomName);
  if (roomSet) {
    roomSet.delete(ws);
    if (roomSet.size === 0) {
      // Last client — save final snapshot immediately
      roomClients.delete(roomName);
      saveSnapshot(roomName, doc);
      console.log(`[Yjs] Last client left room ${roomName} — final snapshot saved`);
    }
  }

  // Cancel pending debounce if any
  debounceSave.cancel();

  // ... rest of existing close handler
});
```

**D. Wire debounced save into the doc update handler:**
```typescript
// After creating the Y.Doc and loading the snapshot:
const debounceSave = createDebouncedSave(roomName, doc);

// In the doc update handler:
const updateHandler = (update: Uint8Array, origin: unknown) => {
  if (origin !== ws) { /* ... relay to other clients ... */ }
  // Debounce snapshot save on every update (not just from this client)
  debounceSave.debouncedSave();
};
```

---

## Data Flow

```
First client connects to room
  ↓
getOrCreateDoc() — returns empty Y.Doc
  ↓
loadSnapshot(boardId, doc) — applies saved Uint8Array via Y.applyUpdate()
  ↓
Send sync step1 to client (now includes restored state)
  ↓
Client receives full board state
  ↓
User makes edits → Y.Doc update fires
  ↓
debouncedSave() — schedules saveSnapshot() in 500ms
  ↓
If another edit arrives within 500ms, timer resets
  ↓
After 500ms of quiet → saveSnapshot() writes bytea to Supabase
  ↓
Last client disconnects
  ↓
Immediate saveSnapshot() — guaranteed final snapshot before room is cleared
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/src/persistence.ts` | loadSnapshot, saveSnapshot, createDebouncedSave |
| `supabase/migrations/board_snapshots.sql` | board_snapshots table + RLS policy |

## Files to Modify

| File | Changes |
|------|---------|
| `server/src/yjs-server.ts` | Add roomClients tracking, load snapshot on first connect, debounced save on update, immediate save on last disconnect |
| `server/.env` | Add SUPABASE_SERVICE_ROLE_KEY |

---

## Environment Variables

Add to `server/.env` and Railway:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Get this from: Supabase Dashboard → Project Settings → API → `service_role` key (secret).

**Do NOT use the anon key for persistence** — the anon key is subject to RLS.
The service role key bypasses RLS entirely and can read/write any table.

---

## Acceptance Criteria (from PRD)

- [ ] Create a sticky note, close all browser tabs, reopen the board — sticky note is still there
- [ ] Create objects in two tabs, close both, reopen one — all objects from both users are present
- [ ] Server logs show debounced snapshot saves (not on every keystroke)
- [ ] New board starts empty (no snapshot found log message)
- [ ] Write a Vitest test: encode a Y.Doc to binary, create a new Y.Doc, apply the update, verify state matches

---

## Technical Gotchas

### 1. `PGRST116` — No rows found is not an error

When loading a snapshot for a brand new board, Supabase returns `PGRST116` (no rows). This
is expected — treat it as "no snapshot, start fresh". Do not throw on this error code.

```typescript
if (error?.code === 'PGRST116') {
  // New board — no snapshot yet, this is fine
  return false;
}
```

### 2. bytea comes back as Base64 from the Supabase REST API

The Supabase JS client returns `bytea` columns as a base64-encoded string via the REST
API (PostgREST). Always convert: `Buffer.from(data.yjs_state, 'base64')`.

If you use the Supabase Postgres driver directly, it comes back as a Buffer.
The REST client is what `@supabase/supabase-js` uses — expect base64.

### 3. Load snapshot BEFORE sending sync step1

The order in the connection handler matters:

```
getOrCreateDoc()  →  loadSnapshot()  →  send sync step1
```

If you send sync step1 before loading the snapshot, the client gets an empty doc and
`Y.applyUpdate` on the client will produce a merge. While CRDT handles this correctly,
the client sees a flash of empty board before objects appear. Loading first is cleaner.

### 4. One snapshot row per board (upsert, not insert)

Use `upsert` with `onConflict: 'board_id'` so there's always exactly one row per board.
Never INSERT a new row on each save — that creates unbounded table growth.

### 5. `getOrCreateDoc` must load snapshot only once

The `getOrCreateDoc` + `loadSnapshot` pattern works because `getOrCreateDoc` creates a
new Y.Doc only when the room has no in-memory entry. The room entry persists in memory as
long as clients are connected, so subsequent connections find the already-loaded doc and
skip the snapshot load.

### 6. Service role key is secret — never expose to frontend

`SUPABASE_SERVICE_ROLE_KEY` is server-only. It should never be in Next.js env vars
(which get bundled) or committed to git. It belongs only in Railway env vars and `.env`
(which is gitignored).

---

## Architecture Rules (Non-Negotiable)

1. **Y.Doc is the source of truth** — never write board objects directly to Postgres
2. **Supabase is the persistence layer only** — not the real-time transport
3. **Service role key for writes** — anon key is subject to RLS and will fail
4. **Debounce, don't save on every update** — prevents Supabase rate limiting and unnecessary writes
5. **Immediate save on last disconnect** — ensures no data loss when a board goes idle

---

## Testing Strategy

### Vitest Unit Test (required by TDD rules)

Write `tests/unit/persistence.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';

describe('Yjs snapshot encode/decode', () => {
  it('restores full Y.Map state from snapshot', () => {
    const doc1 = new Y.Doc();
    const objects = doc1.getMap('objects');
    objects.set('note-1', { id: 'note-1', type: 'sticky_note', x: 100, y: 200 });

    // Serialize
    const snapshot = Y.encodeStateAsUpdate(doc1);

    // Restore into new doc
    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, snapshot);

    const restored = doc2.getMap('objects');
    expect(restored.get('note-1')).toEqual({ id: 'note-1', type: 'sticky_note', x: 100, y: 200 });
  });

  it('round-trips through Buffer (simulates bytea storage)', () => {
    const doc1 = new Y.Doc();
    doc1.getMap('objects').set('test', { value: 42 });

    const snapshot = Y.encodeStateAsUpdate(doc1);
    // Simulate Supabase bytea round-trip
    const stored = Buffer.from(snapshot);
    const retrieved = new Uint8Array(stored);

    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, retrieved);

    expect(doc2.getMap('objects').get('test')).toEqual({ value: 42 });
  });

  it('CRDT merges two concurrent snapshots correctly', () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    doc1.getMap('objects').set('a', { from: 1 });
    doc2.getMap('objects').set('b', { from: 2 });

    // Merge both into doc3
    const doc3 = new Y.Doc();
    Y.applyUpdate(doc3, Y.encodeStateAsUpdate(doc1));
    Y.applyUpdate(doc3, Y.encodeStateAsUpdate(doc2));

    expect(doc3.getMap('objects').get('a')).toEqual({ from: 1 });
    expect(doc3.getMap('objects').get('b')).toEqual({ from: 2 });
  });
});
```

### Manual Testing Checklist (5 min)

**Basic persistence:**
- [ ] Create a sticky note, close all tabs → reopen board → sticky note is there
- [ ] Server log shows: `[Persistence] Snapshot saved for board <id>`
- [ ] Server log shows: `[Persistence] Snapshot loaded for board <id>`

**Multi-user persistence:**
- [ ] Open same board in 2 browsers, both add sticky notes, close both → reopen → all notes present

**New board:**
- [ ] Create a brand new board → server log shows: `No snapshot found for board <id> (new board)`

**Debounce behavior:**
- [ ] Type in a sticky note rapidly → snapshot saves no more than once per 500ms in logs

---

## Environment Reminder

**Client dev server:** `npm run dev` (port 3000)  
**WebSocket server:** `npm run dev` in the `server/` folder (port 4000)  
**Supabase migration:** Run `board_snapshots.sql` in Supabase Dashboard → SQL Editor  
**Service role key:** Supabase Dashboard → Project Settings → API → service_role

---

## Suggested Implementation Order

1. Run the `board_snapshots.sql` migration in Supabase
2. Add `SUPABASE_SERVICE_ROLE_KEY` to `server/.env`
3. Write `tests/unit/persistence.test.ts` first (TDD) — confirm tests fail
4. Create `server/src/persistence.ts` with `loadSnapshot`, `saveSnapshot`, `createDebouncedSave`
5. Run persistence tests — confirm they pass
6. Update `server/src/yjs-server.ts`:
   - Add `roomClients` tracking
   - Load snapshot on first connect (before sync step1)
   - Wire debounced save into the doc update handler
   - Immediate save on last disconnect
7. Restart the server, test single browser: create note, close tab, reopen → note survives
8. Test two browsers: both add notes, both close, reopen → all notes survive

---

## Prompt Seed

> Read `@documentation/agents/agents.md` and `@documentation/architecture/system-design.md`.
> I'm working on TICKET-07: State Persistence (Yjs → Supabase). The server uses in-memory
> Y.Doc storage in `server/src/yjs-server.ts`. Create `server/src/persistence.ts` with
> `loadSnapshot(boardId, doc)`, `saveSnapshot(boardId, doc)`, and `createDebouncedSave()`.
> Use the Supabase **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) to bypass RLS.
> Store `Y.encodeStateAsUpdate(doc)` as bytea in the `board_snapshots` table (one row per
> board, upsert). In `yjs-server.ts`, load the snapshot before sending sync step1 on first
> connect, debounce saves on every Y.Doc update (500ms), and save immediately when the last
> client leaves the room. Create `supabase/migrations/board_snapshots.sql` for the table.
