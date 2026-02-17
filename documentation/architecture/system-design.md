# CollabBoard — System Design

This document defines the architectural contracts for the CollabBoard project. All coding agents must reference this file before implementing any sync, state, or AI-related code.

---

## Data Flow Diagram

Three distinct real-time data paths. Never mix them.

```
[User A Browser]                        [User B Browser]
     │                                        │
     │         ┌──────────────────────┐       │
     ├── cursor:move ──► Socket.io ◄── cursor:move ──┤
     │         │   Server (in-memory) │       │
     │         │   broadcast, no DB   │       │
     │         └──────────────────────┘       │
     │                                        │
     │         ┌──────────────────────┐       │
     ├── Yjs updates ──► y-websocket ◄── Yjs updates ─┤
     │         │   Server (in-memory) │       │
     │         │   CRDT merge + relay │       │
     │         │         │            │       │
     │         │   debounced snapshot  │       │
     │         │   every 500ms or on  │       │
     │         │   disconnect ──► Supabase    │
     │         │              (Postgres)│      │
     │         └──────────────────────┘       │
     │                                        │
     └── ai:command ──► Next.js API ──► OpenAI ──┐
                            │                     │
                            ◄── tool result ──────┘
                            │
                            └── writes to Yjs doc ──► y-websocket ──► All clients
```

---

## State Ownership Map

Every piece of state has exactly one owner. Never duplicate state across systems.

| State | Owner | Sync Method | Persistence |
|---|---|---|---|
| Cursor positions | Client (local) | Socket.io broadcast (20-30Hz throttled) | None (ephemeral) |
| Board objects | Yjs shared document (Y.Map) | y-websocket CRDT sync | Debounced snapshots → Supabase Postgres |
| Selected tool | Client (Zustand) | None (local only) | None |
| Zoom / pan level | Client (Zustand) | None (local only) | None |
| Presence (who's online) | Yjs awareness protocol | y-websocket awareness | None (ephemeral) |
| AI command history | Server (Postgres) | None (query on demand) | Full (DB) |
| Auth session | Client (cookie) | Supabase Auth | Session cookie |

---

## Event Schema Contract

### Cursor Events (Socket.io — ephemeral, high frequency)

Throttled to 20-30Hz on sender side.

```typescript
type CursorMoveEvent = {
  type: 'cursor:move';
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
};
```

### Board Object Sync (Yjs — CRDT, automatic)

No manual event types needed. Yjs handles sync via:
- `Y.Map` for the board objects collection (key = objectId, value = object data)
- `yDoc.on('update', ...)` for observing remote changes
- Awareness protocol for presence

Object schema stored in Yjs Y.Map:

```typescript
type BoardObject = {
  id: string;
  type: 'sticky_note' | 'rectangle' | 'circle' | 'line' | 'connector' | 'frame' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  properties: Record<string, unknown>; // color, text, fontSize, connectedTo, etc.
  createdBy: string;
  updatedAt: string; // ISO timestamp
};
```

### Persistence (Debounced Yjs → Supabase)

Server-side: every 500ms or on last client disconnect, serialize Y.Doc via `Y.encodeStateAsUpdate()` and store as bytea in Postgres. On board load: fetch snapshot, apply via `Y.applyUpdate()`.

### AI Events (REST — request/response)

```typescript
type AICommandRequest = {
  boardId: string;
  command: string;
};

type AICommandResponse = {
  success: boolean;
  actions: AIToolCall[];
  objectsAffected: string[];
  error?: string;
};

type ScopedBoardState = {
  totalObjects: number;
  returnedCount: number;
  objects: BoardObject[]; // max 50, filtered by relevance to command
};
```

---

## Rules

1. Board objects live in Yjs Y.Map — never in Zustand, never written directly to Supabase
2. Cursor positions go through Socket.io — never through Yjs (too high frequency)
3. AI agent tool execution writes to the Yjs doc — same sync path as manual edits
4. Supabase Postgres is the persistence layer only — never the real-time transport
5. All WebSocket connections must verify Supabase JWT before upgrading
6. getBoardState() for AI must be scoped to max 50 objects
7. Cursor events must be throttled to 20-30Hz on the sender side
