# TICKET-03 Kickstart Primer

**Use this to start TICKET-03 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @agents.md, @system-design.md, @PRD.md, and @TESTS.md.

I'm working on TICKET-03: y-websocket Server + Yjs Provider.

Current state:
- ✅ TICKET-01 is COMPLETE (auth, board CRUD, deployed)
- ✅ TICKET-02 is COMPLETE (Konva canvas with pan/zoom)
- ✅ Full-viewport canvas with infinite pan and zoom working
- ✅ Dot grid background scaling with zoom
- ✅ Toolbar stub in place (visual only)
- ✅ All deployed to Vercel: https://collabboard-gauntlet.vercel.app
- ✅ Git workflow established, currently on main branch

What's NOT done yet:
- ❌ No y-websocket server (needs to be created in server/ directory)
- ❌ No Yjs provider on client side
- ❌ No Y.Doc or Y.Map for board objects
- ❌ No Socket.io server for cursors
- ❌ No multiplayer sync capability yet
- ❌ Server not deployed to Railway yet

TICKET-03 Goal:
Create a Node.js server with y-websocket for Yjs document sync and Socket.io for cursor 
broadcast. Server must verify Supabase JWTs. Client must connect to both services and 
establish Y.Doc with Y.Map for board objects. Write integration tests for Yjs sync.

Check @system-design.md for data flow architecture before starting.
Follow the file structure in @presearch.md section 13.

After completion, follow the TICKET-03 testing checklist in @TESTS.md.
```

---

## Context Summary for Agent

### What TICKET-01 + TICKET-02 Delivered

**Infrastructure:**
- Supabase Auth working (JWT sessions in cookies)
- Board CRUD via Supabase Postgres
- Protected `/board/[id]` route
- Full-viewport Konva canvas with pan/zoom
- Dot grid background that scales
- Toolbar UI stub
- Zustand store for UI state (selectedTool, zoom, pan)

**Current Stack:**
- Next.js 15 App Router (TypeScript strict)
- Konva.js + react-konva for canvas
- Supabase Auth + Postgres
- Zustand for UI state only
- Vercel deployment live

**Current Branch:** `main` (clean, no uncommitted changes)

---

### TICKET-03 Scope (from PRD.md)

**Time budget:** 3 hours  
**Dependencies:** TICKET-01 ✅  
**Branch:** `feat/yjs-server`

**Acceptance Criteria:**
- [ ] y-websocket server runs locally and on Railway
- [ ] Two browser tabs connect to the same Y.Doc (console log verification)
- [ ] Socket.io connection established in both tabs (console log verification)
- [ ] Unauthenticated WebSocket connection is rejected
- [ ] Vitest integration test: two Y.Doc instances sync via mock provider

**Implementation Details:**

**Server-side (Node.js):**
1. Create `server/` directory structure:
   ```
   server/
   ├── package.json
   ├── tsconfig.json
   ├── src/
   │   ├── index.ts          # Main server entry
   │   ├── yjs-server.ts     # y-websocket setup
   │   ├── socket-server.ts  # Socket.io setup
   │   └── auth.ts           # JWT verification
   └── .env.example
   ```

2. **y-websocket Server:**
   - One Y.Doc per board (room name = board ID)
   - In-memory document storage (no persistence yet - that's TICKET-07)
   - WebSocket endpoint at `ws://localhost:4000` (local) or Railway URL (prod)

3. **Socket.io Server:**
   - Separate namespace/event for cursor broadcast
   - Room-based broadcast (boardId as room)
   - High-frequency events (will be throttled client-side)

4. **Authentication:**
   - Verify Supabase JWT on WebSocket connection
   - Extract JWT from query param or auth header
   - Use `@supabase/supabase-js` to verify token
   - Reject connection if invalid/missing token

**Client-side:**
1. **`lib/yjs/provider.ts`:**
   - WebsocketProvider from `y-websocket`
   - Connect to server using board ID as room name
   - Pass Supabase session token in connection params
   - Handle connection status (connected, disconnected, synced)

2. **`lib/yjs/board-doc.ts`:**
   - Initialize Y.Doc instance
   - Create Y.Map for board objects
   - Export hooks/functions to interact with the doc
   - Type-safe wrappers around Y.Map operations

3. **`lib/sync/cursor-socket.ts`:**
   - Socket.io client connection
   - Join board room
   - Emit cursor:move events (will throttle in TICKET-05)
   - Listen for remote cursor events

---

### Key Constraints from Rules

1. **Board objects ONLY in Yjs Y.Map** - Never in Zustand, never direct Postgres writes
2. **Cursor events via Socket.io** - Never through Yjs (too high frequency)
3. **JWT verification required** - All WebSocket connections must authenticate
4. **No persistence yet** - TICKET-07 will add Supabase snapshots
5. **TypeScript strict mode** - No `any` types
6. **Separate data paths** - Yjs for objects, Socket.io for cursors (see system-design.md)

---

### Architecture Review (Critical!)

**Three Separate Real-Time Paths:**

```
Path 1: Board Objects (TICKET-03)
  Client Y.Doc ←→ y-websocket server ←→ Other clients' Y.Docs
  - CRDT automatic merge
  - Persistent connection
  - Will add DB snapshots in TICKET-07

Path 2: Cursors (TICKET-03 setup, TICKET-05 implementation)
  Client Socket.io ←→ Socket.io server ←→ Other clients
  - Broadcast only (no merge logic)
  - Ephemeral (no persistence)
  - Throttled to 20-30Hz

Path 3: AI Commands (TICKET-11+)
  Client → Next.js API → OpenAI → writes to Yjs doc → broadcasts to all
```

**DO NOT:**
- Mix cursor events into Yjs (too high frequency)
- Mix board objects into Socket.io (need CRDT merge)
- Store board objects in Zustand (Yjs is the single source of truth)
- Write board objects directly to Postgres (goes through Yjs snapshot in TICKET-07)

---

### Files to Create

**Server:**
```
server/
├── package.json              # Node.js deps: y-websocket, socket.io, ws, @supabase/supabase-js
├── tsconfig.json             # TypeScript config
├── .env.example              # SUPABASE_URL, SUPABASE_ANON_KEY, PORT
├── src/
│   ├── index.ts              # Express + HTTP server, start both services
│   ├── yjs-server.ts         # y-websocket setup, room management
│   ├── socket-server.ts      # Socket.io namespaces, room join/leave
│   └── auth.ts               # JWT verification middleware
└── README.md                 # How to run locally
```

**Client:**
```
lib/
├── yjs/
│   ├── provider.ts           # WebsocketProvider setup
│   └── board-doc.ts          # Y.Doc, Y.Map initialization
└── sync/
    └── cursor-socket.ts      # Socket.io client
```

**Types:**
```
types/
└── board-object.ts           # BoardObject interface (extends from board.ts)
```

**Tests:**
```
tests/
└── integration/
    └── yjs-sync.test.ts      # Vitest integration test
```

---

### Dependencies to Install

**Server (`server/package.json`):**
```bash
cd server
npm init -y
npm install y-websocket socket.io ws @supabase/supabase-js express cors
npm install -D typescript @types/node @types/ws @types/express tsx
```

**Client (root `package.json`):**
```bash
npm install yjs y-websocket socket.io-client
```

---

### Server Implementation Guide

**1. JWT Verification (`server/src/auth.ts`):**
```typescript
import { createClient } from '@supabase/supabase-js';

export async function verifySupabaseToken(token: string): Promise<{ userId: string; email: string } | null> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return null;
  
  return { userId: user.id, email: user.email! };
}
```

**2. y-websocket Setup (`server/src/yjs-server.ts`):**
```typescript
import * as Y from 'yjs';
import { WebSocket } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

// In-memory store for Y.Docs (one per board)
const docs = new Map<string, Y.Doc>();

export function setupYjsServer(wss: WebSocket.Server) {
  wss.on('connection', (ws, req) => {
    // Extract board ID from URL params
    // Verify JWT
    // Call setupWSConnection with the Y.Doc for this board
  });
}
```

**3. Socket.io Setup (`server/src/socket-server.ts`):**
```typescript
import { Server } from 'socket.io';

export function setupSocketIO(httpServer: http.Server) {
  const io = new Server(httpServer, {
    cors: { origin: '*' } // Configure properly for prod
  });
  
  io.on('connection', async (socket) => {
    // Verify JWT from socket.handshake.auth
    // Join board room: socket.join(boardId)
    // Listen for cursor:move
    // Broadcast to room (excluding sender)
  });
  
  return io;
}
```

**4. Main Server (`server/src/index.ts`):**
```typescript
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { setupYjsServer } from './yjs-server';
import { setupSocketIO } from './socket-server';

const app = express();
const server = http.createServer(app);

// y-websocket on /yjs path
const wss = new WebSocketServer({ server, path: '/yjs' });
setupYjsServer(wss);

// Socket.io
setupSocketIO(server);

server.listen(4000, () => {
  console.log('Server running on http://localhost:4000');
});
```

---

### Client Implementation Guide

**1. Yjs Provider (`lib/yjs/provider.ts`):**
```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function createYjsProvider(
  boardId: string, 
  doc: Y.Doc, 
  token: string
): WebsocketProvider {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
  
  const provider = new WebsocketProvider(
    `${wsUrl}/yjs`,
    boardId,
    doc,
    {
      params: { token } // Pass JWT for auth
    }
  );
  
  provider.on('status', (event: { status: string }) => {
    console.log('Yjs connection status:', event.status);
  });
  
  return provider;
}
```

**2. Board Document (`lib/yjs/board-doc.ts`):**
```typescript
import * as Y from 'yjs';

export type BoardObjectType = 'sticky_note' | 'rectangle' | 'circle' | 'line' | 'connector' | 'frame' | 'text';

export interface BoardObject {
  id: string;
  type: BoardObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  properties: Record<string, unknown>;
  createdBy: string;
  updatedAt: string;
}

export function createBoardDoc(): {
  doc: Y.Doc;
  objects: Y.Map<BoardObject>;
} {
  const doc = new Y.Doc();
  const objects = doc.getMap<BoardObject>('objects');
  
  return { doc, objects };
}
```

**3. Socket.io Client (`lib/sync/cursor-socket.ts`):**
```typescript
import { io, Socket } from 'socket.io-client';

export function createCursorSocket(boardId: string, token: string): Socket {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
  
  const socket = io(wsUrl, {
    auth: { token },
  });
  
  socket.on('connect', () => {
    console.log('Socket.io connected');
    socket.emit('join-board', boardId);
  });
  
  socket.on('disconnect', () => {
    console.log('Socket.io disconnected');
  });
  
  return socket;
}
```

---

### Integration in Canvas Component

**Update `components/board/Canvas.tsx`:**
```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import { createBoardDoc } from '@/lib/yjs/board-doc';
import { createYjsProvider } from '@/lib/yjs/provider';
import { createCursorSocket } from '@/lib/sync/cursor-socket';
import { createClient } from '@/lib/supabase/client';

export function Canvas({ boardId }: { boardId: string }) {
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    // Get Supabase session token
    const initSync = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;
      
      // Create Yjs doc
      const { doc, objects } = createBoardDoc();
      setYDoc(doc);
      
      // Connect provider
      const provider = createYjsProvider(boardId, doc, session.access_token);
      
      provider.on('status', (event: { status: string }) => {
        setConnected(event.status === 'connected');
      });
      
      // Connect cursor socket
      const socket = createCursorSocket(boardId, session.access_token);
      
      // Cleanup
      return () => {
        provider.destroy();
        socket.disconnect();
      };
    };
    
    initSync();
  }, [boardId]);
  
  // Rest of Canvas implementation...
}
```

---

### Testing Requirements (from TESTS.md)

**Vitest Integration Test (`tests/integration/yjs-sync.test.ts`):**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

describe('Yjs Sync', () => {
  it('syncs objects between two Y.Doc instances', async () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    
    const objects1 = doc1.getMap('objects');
    const objects2 = doc2.getMap('objects');
    
    // Connect docs (mock or local server)
    // Apply update from doc1 to doc2
    const update = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, update);
    
    // Write to doc1
    objects1.set('sticky1', { 
      id: 'sticky1', 
      type: 'sticky_note',
      x: 100, 
      y: 200,
      // ... other props
    });
    
    // Sync
    const update2 = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, update2);
    
    // Verify doc2 has the object
    expect(objects2.get('sticky1')).toEqual(
      expect.objectContaining({ x: 100, y: 200 })
    );
  });
});
```

**Manual Testing Checklist (5 min):**
- [ ] Server starts without errors (`cd server && npm run dev`)
- [ ] Open browser → navigate to board → check console
- [ ] See "Yjs connection status: connected" log
- [ ] See "Socket.io connected" log
- [ ] Open 2nd browser tab → same board
- [ ] Both tabs show "connected" status
- [ ] No authentication errors in server logs
- [ ] Try without auth (logged out) → connection rejected

---

### Environment Variables

**Server `.env`:**
```
PORT=4000
SUPABASE_URL=https://ifagtpezakzdztufnyze.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
NODE_ENV=development
```

**Client `.env.local` (add):**
```
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

**Production (Railway):**
```
NEXT_PUBLIC_WS_URL=wss://your-railway-app.railway.app
```

---

### Railway Deployment Steps

1. **Create Railway project:**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Initialize
   cd server
   railway init
   ```

2. **Configure Railway:**
   - Add environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
   - Set start command: `npm run build && npm start`
   - Enable WebSocket support

3. **Deploy:**
   ```bash
   railway up
   ```

4. **Get Railway URL:**
   ```bash
   railway domain
   ```

5. **Update client `.env.local`:**
   ```
   NEXT_PUBLIC_WS_URL=wss://your-app.railway.app
   ```

---

### Common Gotchas

1. **CORS Issues:** Configure Socket.io and WebSocket CORS properly for production
2. **JWT Format:** Supabase access_token is a Bearer token, ensure it's passed correctly
3. **WebSocket Path:** y-websocket needs a separate path (e.g., `/yjs`)
4. **Port Conflicts:** Server port 4000 might be in use, handle gracefully
5. **Memory Leaks:** Clean up providers and sockets in useEffect cleanup
6. **Railway WebSocket:** Ensure Railway service enables WebSocket connections

---

### Definition of Done

**Code complete when:**
- [ ] Server runs locally (`cd server && npm run dev`)
- [ ] Two browser tabs connect to same board
- [ ] Console shows "Yjs connected" and "Socket.io connected"
- [ ] Unauthenticated connection rejected
- [ ] Vitest integration test passes
- [ ] No console errors or warnings

**Ticket complete when:**
- [ ] All code complete criteria met
- [ ] Server deployed to Railway
- [ ] Client connects to Railway server (update NEXT_PUBLIC_WS_URL)
- [ ] Tests pass (Vitest, build)
- [ ] DEV-LOG.md updated
- [ ] TICKETS.md updated
- [ ] Committed to `feat/yjs-server` branch
- [ ] Pushed to GitHub
- [ ] Merged to `main`

---

### Expected Output

After TICKET-03, the system should:
1. Run a Node.js server with y-websocket and Socket.io
2. Authenticate WebSocket connections via Supabase JWT
3. Client creates Y.Doc with Y.Map for board objects
4. Two browser tabs connect to the same Y.Doc (verified via console)
5. Socket.io connections established (verified via console)
6. Server deployed to Railway
7. **No visual changes yet** - just infrastructure setup

Objects won't be rendered on the canvas until TICKET-04.

---

### Time Management

**Estimated: 3 hours**

- Server setup (package.json, tsconfig): 15 min
- JWT verification: 20 min
- y-websocket implementation: 45 min
- Socket.io implementation: 30 min
- Client Yjs provider: 20 min
- Client Socket.io client: 15 min
- Integration testing: 20 min
- Railway deployment: 20 min
- Documentation: 10 min
- Commit/push: 5 min

**Total: ~3 hours**

---

### Quick Reference Links

- PRD TICKET-03: Line 110-134 in `PRD.md`
- Testing checklist: Search "TICKET-03" in `TESTS.md`
- System design: `system-design.md` (data flow diagram)
- Yjs docs: https://docs.yjs.dev/
- y-websocket: https://github.com/yjs/y-websocket
- Socket.io: https://socket.io/docs/v4/

---

### Critical Architecture Review

Before writing any code, review `system-design.md`:
- Understand the three separate real-time data paths
- Yjs for board objects (CRDT merge, persistent)
- Socket.io for cursors (broadcast only, ephemeral)
- Never mix these two paths

**If you violate the architecture, multiplayer sync will break.**

---

**Ready to start TICKET-03!** 🚀

Copy the primer above into a new Cursor chat and the agent will have full context to build the real-time sync infrastructure.
