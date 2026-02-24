# TICKET-24: Production Polish — Real-Time Presence, Cursors & Viewport Persistence

**Use this to start TICKET-24 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/requirements/PRD.md, @documentation/tickets/TICKET-24-PRIMER.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-24: Production Polish.

Current state:
- The app is deployed at https://collabboard-gauntlet.vercel.app
- All 306 tests pass (36 test files)
- Neo-brutalism UI is live in production
- AI agent works (deterministic planner + LLM fallback)
- The WebSocket server (Railway) handles Yjs sync and Socket.io cursor broadcast

Known bugs to fix (in priority order):

BUG 1 — Presence avatars not syncing across users
Two users on the same board both see "1 online" instead of "2 online". The presence system uses Yjs awareness protocol (not Socket.io). Avatars are rendered by PresenceBar.tsx which subscribes to provider.awareness.on('change'). The awareness state is set in Canvas.tsx:1096-1123. Possible causes:
- The Yjs WebSocket connection may be failing auth (expired JWT) so each user gets an isolated Y.Doc
- The awareness update may not be broadcasting to the correct room on the server
- The CORS config in yjs-server.ts may be blocking the second user's connection
Key files: components/board/PresenceBar.tsx, components/board/Canvas.tsx (lines 1096-1145), server/src/yjs-server.ts (awareness handling), lib/yjs/provider.ts

BUG 2 — Viewport position not persisting on reload
The viewport (pan/zoom) should survive page refresh. The system uses localStorage keyed by boardId. Save is debounced at 150ms in Canvas.tsx:505-512. Load happens on mount at Canvas.tsx:497-503. The viewportReady flag prevents overwriting saved state with defaults.
Key files: lib/utils/viewport-storage.ts, stores/ui-store.ts, components/board/Canvas.tsx (lines 497-512)

BUG 3 — Remote cursors not visible to other users
Users should see each other's cursors in real-time. Cursors use Socket.io (separate from Yjs). The flow: Canvas.tsx handleMouseMove → throttled emit at 40ms (25Hz) → server broadcasts to room → RemoteCursorsLayer.tsx receives and renders. Possible causes:
- Socket.io connection may be failing auth (same JWT issue as presence)
- CORS on the Socket.io server only allows collabboard-gauntlet.vercel.app in production (server/src/socket-server.ts:17-19)
- The cursor:move event may not be reaching the server if the socket never connects
Key files: lib/sync/cursor-socket.ts, components/board/RemoteCursorsLayer.tsx, components/board/Canvas.tsx (lines 535-569, 761-784), server/src/socket-server.ts, lib/sync/throttle.ts

General polish tasks after bugs are fixed:
- Verify all features work end-to-end on production (not just localhost)
- Check Railway WebSocket server logs for connection errors
- Verify CORS settings include the production domain for both Yjs and Socket.io
- Ensure JWT tokens are refreshed before they expire during long sessions
- Test with 2+ concurrent users on production

Constraints:
- All 306 existing tests must continue to pass
- Write new tests for any bug fixes
- Follow TDD: write failing test first, then fix
- Do NOT change any AI agent logic — this ticket is infrastructure/real-time only
```

---

## Quick Reference

**Time Budget:** 4-6 hours  
**Branch:** `fix/production-polish`  
**Dependencies:** All prior tickets complete, production deployed  
**Risk:** Medium (touches real-time infrastructure, requires multi-user testing)

---

## Objective

Fix three production bugs related to real-time collaboration and viewport persistence, then verify the full app works end-to-end on production with multiple concurrent users.

---

## Known Bugs

### BUG 1: Presence Avatars Not Syncing

**Symptom:** Two users on the same board each see only "1 online" and only their own avatar. The PresenceBar shows the local user but not remote users.

**Screenshots:** See the two screenshots — user "A" (orange avatar) sees "1 online", user "J" (blue avatar) also sees "1 online". They are on the same board.

**Architecture:**
- Presence uses the **Yjs awareness protocol**, NOT Socket.io
- `Canvas.tsx:1096-1123` sets `provider.awareness.setLocalStateField('user', {...})`
- `PresenceBar.tsx` subscribes to `provider.awareness.on('change')` and deduplicates by `userId`
- The server (`yjs-server.ts`) manages awareness per room via `awarenessProtocol.Awareness`
- Awareness updates are broadcast to all clients in the room via the `update` event handler

**Investigation leads:**
1. Check if both users' Yjs WebSocket connections are succeeding (look for `Token verification failed` in Railway logs)
2. Check if both connections land in the same room (room name = boardId)
3. Check if the awareness broadcast handler (`yjs-server.ts:218-246`) is sending to the correct set of clients
4. Check if the CORS config on the Yjs HTTP upgrade allows the production origin
5. Test locally with two browser windows to isolate whether the bug is production-only

**Key files:**
- `components/board/PresenceBar.tsx` — renders avatars from awareness state
- `components/board/Canvas.tsx:1096-1145` — sets and tracks awareness
- `server/src/yjs-server.ts` — server-side awareness management
- `lib/yjs/provider.ts` — WebSocket provider factory
- `types/presence.ts` — AwarenessUser / AwarenessState types

---

### BUG 2: Viewport Position Not Persisting

**Symptom:** When a user pans/zooms the board and refreshes the page, the viewport resets to the default position (zoom: 1, pan: {x: 0, y: 0}) instead of restoring the saved position.

**Architecture:**
- Viewport is stored in localStorage keyed by `canvasViewport:${boardId}`
- `saveViewport()` writes `{ zoom, pan }` as JSON
- `loadViewport()` reads, validates, and clamps zoom to [0.01, 10]
- Canvas.tsx loads on mount (line 497-503), saves on change with 150ms debounce (line 505-512)
- A `viewportReady` flag prevents saving before the load completes

**Investigation leads:**
1. Check if `loadViewport()` is being called with the correct `boardId`
2. Check if `saveViewport()` is actually writing to localStorage (inspect Application > Local Storage in dev tools)
3. Check if there's a race condition where the save fires with default values before the load completes
4. Check if the `viewportReady` flag is being set correctly

**Key files:**
- `lib/utils/viewport-storage.ts` — save/load/validate functions
- `stores/ui-store.ts` — Zustand store with zoom/pan state
- `components/board/Canvas.tsx:497-512` — load/save lifecycle

---

### BUG 3: Remote Cursors Not Visible

**Symptom:** Users on the same board cannot see each other's cursors.

**Architecture:**
- Cursors use **Socket.io** (separate connection from Yjs)
- `createCursorSocket()` in `lib/sync/cursor-socket.ts` connects to `NEXT_PUBLIC_WS_URL` (or `localhost:4000`)
- On connect, the client emits `join-board` with the boardId to enter the room
- `Canvas.tsx` throttles cursor emission at 40ms (~25Hz) via `lib/sync/throttle.ts`
- Server (`socket-server.ts:68-74`) broadcasts `cursor:move` to all other clients in the room
- `RemoteCursorsLayer.tsx` receives events, queues them, and flushes via `requestAnimationFrame`
- Own cursor is filtered out by checking `data.userId === currentUserId`
- Stale cursors are removed after 5 seconds of inactivity

**Investigation leads:**
1. Check if the Socket.io connection is established at all (look for `[Cursor Socket] Connected` in browser console)
2. Check CORS — `socket-server.ts:17-19` only allows `collabboard-gauntlet.vercel.app` in production. If the user accesses via a different domain (e.g., the deployment-specific Vercel URL), Socket.io will reject the connection
3. Check if `join-board` is emitted successfully (the user must be in the same room)
4. Check if cursor events are being emitted (add a temporary log in `emitCursorMove`)
5. Test locally with two browser windows to isolate

**Key files:**
- `lib/sync/cursor-socket.ts` — Socket.io client factory
- `components/board/RemoteCursorsLayer.tsx` — renders remote cursors
- `components/board/Canvas.tsx:535-569` — cursor emission logic
- `server/src/socket-server.ts` — server-side broadcast
- `lib/sync/throttle.ts` — emission throttling
- `lib/sync/cursor-queue.ts` — event deduplication

---

## Environment & Configuration

**Production URLs:**
- Frontend: `https://collabboard-gauntlet.vercel.app`
- WebSocket server: Check `NEXT_PUBLIC_WS_URL` in Vercel env vars (should point to Railway deployment)

**CORS — must match for both servers:**
- `server/src/socket-server.ts:17-19` — Socket.io CORS origins
- `server/src/yjs-server.ts` — Yjs WebSocket upgrade (check if CORS headers are set)

**Auth flow:**
- Client gets JWT from Supabase session (`session.access_token`)
- Yjs provider passes token as URL param: `{ params: { token } }`
- Socket.io passes token in handshake: `{ auth: { token } }`
- Server verifies via `verifySupabaseToken()` in `server/src/auth.ts`
- If the token expires mid-session, connections will fail silently

**Environment variables (Vercel):**
- `NEXT_PUBLIC_WS_URL` — must point to the Railway WebSocket server URL
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase config

**Environment variables (Railway):**
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — for token verification and persistence
- `PORT` — Railway assigns this automatically
- `NODE_ENV` — should be `production`

---

## Testing Strategy

**Unit tests to add:**
- Viewport save/load round-trip with edge cases (empty boardId, corrupted JSON, missing key)
- Presence deduplication with simulated awareness states
- Cursor event filtering (own cursor excluded, stale cursor cleanup)

**Integration tests to add:**
- Two simulated Yjs docs sharing awareness and verifying mutual visibility
- Cursor emit → receive round-trip with throttle verification

**Manual testing checklist (production):**
- [ ] Open same board in two different browsers (not just tabs — different browser profiles or incognito)
- [ ] Verify both users see "2 online" with both avatars
- [ ] Verify cursor movement is visible on the other user's screen
- [ ] Pan and zoom the board, refresh, verify position is restored
- [ ] Create a sticky note on one browser, verify it appears on the other
- [ ] Run an AI command on one browser, verify the result appears on the other
- [ ] Close one browser, verify the remaining user sees "1 online" within a few seconds
- [ ] Test on the production URL (not localhost) to catch CORS issues

---

## Existing Test Suite

All 306 tests across 36 files pass as of this ticket's creation. Key test files related to this ticket:

- `tests/unit/presence.test.ts` (9 tests) — awareness state shape and deduplication
- `tests/unit/viewport-storage.test.ts` (11 tests) — localStorage save/load
- `tests/unit/sync/throttle.test.ts` (2 tests) — cursor throttle timing
- `tests/unit/sync/cursor-queue.test.ts` (2 tests) — cursor event deduplication

---

## Definition of Done

- [ ] Two users on the same board see each other's avatars and correct online count
- [ ] Remote cursors are visible in real-time across users
- [ ] Viewport position persists across page refresh
- [ ] All existing 306 tests still pass
- [ ] New tests added for each bug fix
- [ ] Manual testing checklist completed on production
- [ ] Changes committed and deployed to production
