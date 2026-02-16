# CollabBoard — Product Requirements Document

**Project:** Real-Time Collaborative Whiteboard with AI Agent  
**Sprint:** 1 week (Feb 16–23, 2026)  
**Architecture Reference:** See `presearch.md` for full architectural decisions and justifications  
**System Design Reference:** See `system-design.md` for data flow diagrams, state ownership, and event schemas  
**Agent Context:** See `agents.md` for coding agent non-negotiables  

---

## Objective

Build a production-scale collaborative whiteboard (comparable to Miro) with real-time multiplayer sync and an AI agent that manipulates the board via natural language. The whiteboard must support 5+ concurrent users, 500+ objects, and meet strict latency targets (<50ms cursor sync, <100ms object sync, 60fps canvas rendering).

---

## Architecture Summary (from Pre-Search)

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js 15 (App Router) + Konva.js + react-konva | Canvas rendering, UI, auth flow |
| Real-time (objects) | Yjs CRDT + y-websocket | Board object sync, conflict-free merging |
| Real-time (cursors) | Socket.io broadcast (20-30Hz) | Ephemeral cursor positions |
| Persistence | Supabase PostgreSQL | Yjs doc snapshots (bytea), board metadata |
| Auth | Supabase Auth | Email/password, magic link, JWT sessions |
| AI Agent | OpenAI GPT-4o-mini (function calling) | Natural language → board manipulation |
| Deployment | Vercel (frontend) + Railway (WS server) + Supabase (DB/Auth) | Three-tier split |

---

## Milestone Map

| Milestone | Deadline | Tickets | Gate |
|---|---|---|---|
| **Pre-Search** | Mon 2:00 PM CT | — | Submitted |
| **MVP** | Tue 11:59 PM CT | TICKET-01 → TICKET-07 | Hard gate — all 9 MVP items required |
| **Early Submission** | Fri 11:59 PM CT | TICKET-08 → TICKET-12 | Feature-complete + demo video |
| **Final Submission** | Sun 10:59 PM CT | TICKET-13 → TICKET-15 | Polish, docs, cost analysis, social post |

---

## MVP Requirements (Hard Gate — Tuesday Midnight)

All 9 items must be working and deployed:

- [ ] Infinite board with pan/zoom
- [ ] Sticky notes with editable text
- [ ] At least one shape type (rectangle, circle, or line)
- [ ] Create, move, and edit objects
- [ ] Real-time sync between 2+ users
- [ ] Multiplayer cursors with name labels
- [ ] Presence awareness (who's online)
- [ ] User authentication
- [ ] Deployed and publicly accessible

---

## Ticket Breakdown

### TICKET-01: Project Scaffold + Auth
**Time budget:** 2 hours  
**Dependencies:** None  
**Branch:** `feat/scaffold-auth`

**Scope:**
- Initialize Next.js 15 project with TypeScript strict mode, Tailwind v4, ESLint, Prettier
- Create Supabase project (Postgres + Auth)
- Implement email/password login and signup via Supabase Auth
- Create protected route at `/board/[id]` that redirects unauthenticated users to login
- Create a landing page at `/` that lists boards and has a "Create Board" button
- Board creation writes a row to `boards` table in Supabase and redirects to `/board/[id]`
- Deploy frontend to Vercel, confirm auto-deploy from GitHub `main`

**Done when:**
- [ ] User can sign up, log in, and log out
- [ ] Authenticated user can create a board and navigate to it
- [ ] Unauthenticated visit to `/board/[id]` redirects to login
- [ ] Deployed on Vercel with working auth

**Cursor prompt seed:**
> Read `@agents.md` and `@system-design.md`. Scaffold a Next.js 15 App Router project with Supabase Auth (email/password). Create a login page, a board list page, and a protected `/board/[id]` route. Use Zustand for UI state. Follow the file structure in `@presearch.md` section 13.

---

### TICKET-02: Konva Canvas with Pan/Zoom
**Time budget:** 1.5 hours  
**Dependencies:** TICKET-01  
**Branch:** `feat/canvas`

**Scope:**
- Install `konva` and `react-konva`
- Create `Canvas.tsx` — a full-viewport Konva Stage inside `/board/[id]`
- Implement infinite pan (drag on empty canvas) and zoom (mouse wheel)
- Add a subtle grid or dot pattern background that scales with zoom
- Display current zoom level in the UI
- Toolbar component stub (no tools active yet, just the visual bar)

**Done when:**
- [ ] Canvas fills the viewport on the board page
- [ ] User can pan by dragging empty space
- [ ] User can zoom with mouse wheel (smooth, 60fps)
- [ ] Zoom level is displayed
- [ ] No objects yet — this is just the empty canvas

**Cursor prompt seed:**
> I've completed TICKET-01 (auth + scaffold). Now implement TICKET-02: a full-viewport Konva Stage with infinite pan/zoom in the `/board/[id]` page. Use react-konva. Pan via Stage `draggable`, zoom via `wheel` event adjusting `scaleX/scaleY`. Add a dot grid background. Refer to `@docs/Konva.js` for API patterns.

---

### TICKET-03: y-websocket Server + Yjs Provider
**Time budget:** 3 hours  
**Dependencies:** TICKET-01  
**Branch:** `feat/yjs-server`

**Scope:**
- Create `server/` directory with a Node.js y-websocket + Socket.io server
- y-websocket handles Yjs document sync (one Y.Doc per board, room name = board ID)
- Socket.io handles cursor broadcast on a separate namespace/event
- Server authenticates WebSocket connections by verifying Supabase JWT from query param or auth header
- Client-side: create `lib/yjs/provider.ts` that connects to the y-websocket server on board load
- Client-side: create `lib/yjs/board-doc.ts` that initializes `Y.Map<BoardObject>` as the shared type
- Client-side: create `lib/sync/cursor-socket.ts` that connects Socket.io for cursor events
- Deploy server to Railway

**Done when:**
- [ ] y-websocket server runs locally and on Railway
- [ ] Two browser tabs connect to the same Y.Doc (verify via console log of Yjs connection status)
- [ ] Socket.io connection established in both tabs (verify via console log)
- [ ] Unauthenticated WebSocket connection is rejected
- [ ] Write a Vitest integration test: two Y.Doc instances connected via mock provider, write to one, read from the other

**Cursor prompt seed:**
> I've completed TICKET-01 and TICKET-02. Now implement TICKET-03: a y-websocket + Socket.io server in the `server/` directory. The server must verify Supabase JWTs on connection. On the client, create a Yjs provider in `lib/yjs/provider.ts` that connects to the server using the board ID as the room name. Create `lib/yjs/board-doc.ts` that initializes a `Y.Map` for board objects. Create `lib/sync/cursor-socket.ts` for Socket.io cursor broadcast. Refer to `@docs/Yjs CRDT` and `@docs/Socket.io`.

---

### TICKET-04: Sticky Note CRUD via Yjs
**Time budget:** 2.5 hours  
**Dependencies:** TICKET-02, TICKET-03  
**Branch:** `feat/sticky-notes`

**Scope:**
- Create `StickyNote.tsx` Konva component (colored rectangle + editable text)
- "Add Sticky Note" tool in toolbar — click on canvas to place a new sticky note
- Sticky note creation writes to the Yjs `Y.Map` with a unique ID as key
- Moving a sticky note (drag) updates `x, y` in the Yjs map entry
- Double-click to edit text inline (Konva `Text` + HTML overlay for editing)
- Color picker for sticky note background (at least 6 colors)
- Delete via keyboard (select + Backspace/Delete)
- All operations sync to other connected clients via Yjs automatically
- Observe `Y.Map` changes and re-render Konva nodes reactively

**Done when:**
- [ ] User can create a sticky note by clicking on the canvas
- [ ] User can drag the sticky note to move it
- [ ] User can double-click to edit the text
- [ ] User can change the sticky note color
- [ ] User can delete a sticky note
- [ ] All of the above appear instantly on a second browser tab
- [ ] Write a Vitest unit test: create object in Y.Map, verify properties, simulate remote update, verify local Y.Map reflects it

**Cursor prompt seed:**
> I've completed TICKET-01 through TICKET-03. The canvas renders, and two browsers connect to the same Yjs document. Now implement TICKET-04: Sticky note CRUD. The Yjs `Y.Map` in `board-doc.ts` is the single source of truth. Create a `StickyNote.tsx` react-konva component. Observe the Y.Map for changes and render a Konva Group (Rect + Text) for each entry. Creation, move, edit, and delete all write to the Y.Map — Yjs handles sync. Do NOT write to Supabase directly. Do NOT store objects in Zustand.

---

### TICKET-05: Multiplayer Cursors via Socket.io
**Time budget:** 1.5 hours  
**Dependencies:** TICKET-03  
**Branch:** `feat/cursors`

**Scope:**
- On `mousemove` over the Konva Stage, emit `cursor:move` via Socket.io (throttled to 25Hz)
- Include `userId`, `userName`, `x`, `y`, `color` in the event payload
- Convert screen coordinates to canvas coordinates (account for pan/zoom)
- Server relays `cursor:move` to all other clients in the same board room (exclude sender)
- Create `Cursors.tsx` — renders a Konva layer with remote cursor indicators (small arrow + name label)
- Remote cursors should smoothly interpolate position (not jump between updates)
- Cursor disappears when a remote user disconnects

**Done when:**
- [ ] Moving mouse in Browser A shows a labeled cursor in Browser B
- [ ] Cursor positions are correct even when zoomed/panned
- [ ] No cursor echo (sender doesn't see their own remote cursor)
- [ ] Cursor disappears within 2 seconds of the other user disconnecting
- [ ] Performance: cursor updates don't drop canvas below 60fps

**Cursor prompt seed:**
> I've completed TICKET-01 through TICKET-04. Now implement TICKET-05: multiplayer cursors. On mousemove over the Konva Stage, emit `cursor:move` via the Socket.io client in `lib/sync/cursor-socket.ts`. Throttle to 25Hz using `lib/sync/throttle.ts`. The server relays to all other clients in the room. Create `Cursors.tsx` that renders remote cursors as Konva arrows with name labels. Convert screen coords to canvas coords accounting for Stage scale and position.

---

### TICKET-06: Presence Awareness
**Time budget:** 1 hour  
**Dependencies:** TICKET-03  
**Branch:** `feat/presence`

**Scope:**
- Use Yjs awareness protocol to track who's online
- Each client sets awareness state on connect: `{ userId, userName, color, isOnline: true }`
- Create a presence bar UI component (list of online user avatars/names, colored dots)
- When a user disconnects, awareness protocol automatically removes them
- Display user count

**Done when:**
- [ ] Opening a board shows the current user in the presence bar
- [ ] Opening the same board in a second browser shows both users
- [ ] Closing one browser removes that user from the presence bar within 3 seconds
- [ ] Each user has a distinct color (used for both cursor and presence indicator)

---

### TICKET-07: State Persistence (Yjs → Supabase)
**Time budget:** 2 hours  
**Dependencies:** TICKET-03, TICKET-04  
**Branch:** `feat/persistence`

**Scope:**
- Create `board_snapshots` table in Supabase: `id`, `board_id` (unique), `yjs_state` (bytea), `snapshot_at`
- Server-side: on Y.Doc update, debounce a snapshot save (every 500ms max)
- Snapshot = `Y.encodeStateAsUpdate(yDoc)` stored as bytea via Supabase client
- On last client disconnect from a room, immediately save a final snapshot
- On first client connect to a room, load the latest snapshot from Supabase and apply via `Y.applyUpdate()`
- If no snapshot exists (new board), start with an empty Y.Doc
- Create `server/persistence.ts` to encapsulate this logic

**Done when:**
- [ ] Create a sticky note, close all browser tabs, reopen the board — sticky note is still there
- [ ] Create objects in two tabs, close both, reopen one — all objects from both users are present
- [ ] Server logs show debounced snapshot saves (not on every keystroke)
- [ ] Write a Vitest test: encode a Y.Doc to binary, create a new Y.Doc, apply the update, verify state matches

**Cursor prompt seed:**
> I've completed TICKET-01 through TICKET-06. Now implement TICKET-07: Yjs persistence. In `server/persistence.ts`, on every Y.Doc update, debounce a save to Supabase's `board_snapshots` table. Use `Y.encodeStateAsUpdate()` to serialize and store as bytea. On room init (first client connects), load the latest snapshot via `Y.applyUpdate()`. On last client disconnect, do an immediate save. Create the Supabase migration for `board_snapshots`. Refer to `@docs/Yjs CRDT` for encoding/decoding.

---

### TICKET-08: Shapes (Rectangle, Circle, Line)
**Time budget:** 2 hours  
**Dependencies:** TICKET-04  
**Branch:** `feat/shapes`

**Scope:**
- Create `Shape.tsx` component that renders rectangles, circles, and lines via react-konva
- Add shape tools to toolbar (rectangle, circle, line)
- Click-and-drag on canvas to draw a shape (start point to end point defines dimensions)
- Shapes write to the same Yjs `Y.Map` as sticky notes (same sync path)
- Shapes support: move (drag), resize (corner handles), color fill, stroke color
- Line tool draws a simple line between two points

**Done when:**
- [ ] User can draw a rectangle by clicking and dragging
- [ ] User can draw a circle by clicking and dragging
- [ ] User can draw a line between two points
- [ ] Shapes sync to other browsers via Yjs
- [ ] Shapes can be moved, resized, and color-changed

---

### TICKET-09: Connectors + Frames
**Time budget:** 2.5 hours  
**Dependencies:** TICKET-08  
**Branch:** `feat/connectors-frames`

**Scope:**
- `Connector.tsx` — arrow/line that connects two objects by ID
- Connector endpoints update when connected objects move (reactive to Yjs changes)
- `Frame.tsx` — a labeled rectangular region for grouping content
- Frame title is editable
- Objects inside a frame move with the frame when the frame is dragged (optional for MVP, required for final)
- Both connectors and frames stored in the same Yjs `Y.Map`

**Done when:**
- [ ] User can draw a connector from one object to another
- [ ] Moving a connected object updates the connector endpoints in real-time
- [ ] User can create a frame with an editable title
- [ ] Connectors and frames sync via Yjs

---

### TICKET-10: Selection + Transforms
**Time budget:** 2 hours  
**Dependencies:** TICKET-04, TICKET-08  
**Branch:** `feat/selection`

**Scope:**
- Single-click to select an object (visual selection indicator — blue border/handles)
- Shift-click to multi-select
- Drag-to-select (rubber band selection box)
- Selected objects can be: moved together, deleted (Backspace), duplicated (Cmd+D), copy/pasted (Cmd+C/V)
- Resize handles on selected objects (corner drag)
- Rotate handle on selected objects (optional for MVP)
- All transforms write to Yjs

**Done when:**
- [ ] User can select a single object (visual indicator appears)
- [ ] User can shift-click to multi-select
- [ ] User can drag-select a region
- [ ] Delete, duplicate, copy/paste work on selection
- [ ] Resize handles work on individual objects
- [ ] All operations sync via Yjs

---

### TICKET-11: AI Agent — Basic Commands
**Time budget:** 3 hours  
**Dependencies:** TICKET-04, TICKET-08  
**Branch:** `feat/ai-basic`

**Scope:**
- Create `AICommandBar.tsx` — a text input at the bottom of the board (similar to a chat bar)
- Create `/api/ai/command/route.ts` — accepts `{ boardId, command }`, calls OpenAI with function calling
- Implement tool definitions in `lib/ai-agent/tools.ts`:
  - `createStickyNote(text, x, y, color)`
  - `createShape(type, x, y, width, height, color)`
  - `createFrame(title, x, y, width, height)`
  - `createConnector(fromId, toId, style)`
  - `moveObject(objectId, x, y)`
  - `updateText(objectId, newText)`
  - `changeColor(objectId, color)`
  - `getBoardState()` — scoped, max 50 objects (see `lib/ai-agent/scoped-state.ts`)
- Tool execution in `lib/ai-agent/executor.ts` writes results to the Yjs doc via the server
- AI-generated changes appear in real-time for all connected users
- Show a loading indicator while AI is processing

**Done when:**
- [ ] User types "Add a yellow sticky note that says 'User Research'" → sticky note appears
- [ ] User types "Create a blue rectangle at position 100, 200" → rectangle appears
- [ ] User types "Move all the pink sticky notes to the right side" → notes move
- [ ] User types "Change the sticky note color to green" → color changes
- [ ] AI changes appear for all connected users in real-time
- [ ] Response time is <2 seconds for single-step commands
- [ ] 6+ distinct command types work

**Cursor prompt seed:**
> I've completed TICKET-01 through TICKET-10. The whiteboard has full multiplayer sync via Yjs. Now implement TICKET-11: the AI agent. Create an `AICommandBar.tsx` input component. Create the API route at `/api/ai/command/route.ts` that uses OpenAI GPT-4o-mini function calling. Define tools in `lib/ai-agent/tools.ts` following the schema in the assignment doc. Tool execution must write to the Yjs doc — not directly to the canvas or to Supabase. Implement `getBoardState()` in `lib/ai-agent/scoped-state.ts` with a 50-object cap. Refer to `@docs/OpenAI Function Calling`.

---

### TICKET-12: AI Agent — Complex Commands
**Time budget:** 2.5 hours  
**Dependencies:** TICKET-11  
**Branch:** `feat/ai-complex`

**Scope:**
- Multi-step command execution: AI plans steps and executes them sequentially
- Template commands:
  - "Create a SWOT analysis" → 4 labeled quadrants (frames + headers)
  - "Build a user journey map with 5 stages" → 5 columns with headers
  - "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns" → 3 frames with titles
- Layout commands:
  - "Arrange these sticky notes in a grid" → objects aligned with consistent spacing
  - "Create a 2x3 grid of sticky notes for pros and cons" → 6 notes in grid layout
  - "Space these elements evenly" → equal spacing calculation
- Multi-step commands call multiple tools sequentially (plan → execute step 1 → execute step 2 → ...)
- Add `resizeObject(objectId, width, height)` to tool set

**Done when:**
- [ ] "Create a SWOT analysis" produces 4 labeled quadrants
- [ ] "Arrange in a grid" aligns elements with consistent spacing
- [ ] Multi-step commands execute sequentially without errors
- [ ] Complex commands complete in <5 seconds
- [ ] Multiple users can issue AI commands simultaneously without conflict (both write to Yjs)

---

### TICKET-13: Performance Profiling + Hardening
**Time budget:** 2 hours  
**Dependencies:** All previous tickets  
**Branch:** `feat/performance`

**Scope:**
- Add performance metrics logging (fps counter, sync latency measurement, object count)
- Verify performance targets:
  - 60fps during pan/zoom/object manipulation
  - <100ms object sync latency
  - <50ms cursor sync latency
  - 500+ objects without degradation
  - 5+ concurrent users without degradation
- Optimize if targets are not met:
  - Konva: use `listening: false` on static shapes, batch layer redraws
  - Yjs: check if update frequency is too high, debounce non-critical updates
  - Socket.io: verify cursor throttle is working at 25Hz
- Network resilience testing:
  - Throttle network in Chrome DevTools, verify graceful degradation
  - Kill and restart the WebSocket server, verify clients reconnect and state recovers

**Done when:**
- [ ] All 5 performance targets are met (documented with measurements)
- [ ] Network throttling doesn't crash the app
- [ ] Disconnect/reconnect recovers state without data loss

---

### TICKET-14: Documentation + AI Dev Log + Cost Analysis
**Time budget:** 2 hours  
**Dependencies:** All previous tickets  
**Branch:** `feat/docs`

**Scope:**
- Finalize `README.md`: setup guide, architecture overview, deployed link
- Write AI Development Log (1 page):
  - Tools & workflow (Cursor + Claude Code, how they were paired)
  - MCP usage (if any)
  - 3-5 effective prompts (copy actual prompts that worked well)
  - Code analysis (rough % AI-generated vs. hand-written)
  - Strengths & limitations of AI coding agents for this project
  - Key learnings
- Finalize AI Cost Analysis:
  - Actual dev spend (track OpenAI API usage, Cursor token consumption)
  - Production projections at 100 / 1,000 / 10,000 / 100,000 users (from pre-search, updated with real numbers)
- Record 3-5 minute demo video:
  - Show real-time collaboration (two browsers)
  - Show AI commands in action
  - Briefly explain architecture (Yjs + Socket.io + Supabase)

**Done when:**
- [ ] README has setup instructions that work from a fresh clone
- [ ] AI Dev Log covers all required sections
- [ ] Cost analysis has real dev numbers + production projections
- [ ] Demo video uploaded and linked in submission

---

### TICKET-15: Final Polish + Social Post
**Time budget:** 1.5 hours  
**Dependencies:** TICKET-14  
**Branch:** `main` (direct commits for polish)

**Scope:**
- UI polish: consistent colors, hover states, loading indicators, error messages
- Handle edge cases: empty board state, long text overflow on sticky notes, very small shapes
- Verify deployed app is publicly accessible with auth
- Complete AI interview via portal
- Post on LinkedIn or X:
  - Description of what was built
  - Key features (real-time collab, AI agent)
  - Demo video or screenshots
  - Tag @GauntletAI

**Done when:**
- [ ] Deployed app works end-to-end for a new user (signup → create board → add objects → see sync)
- [ ] AI interview completed
- [ ] Social post published
- [ ] All submission deliverables uploaded to portal

---

## Time Budget Summary

| Phase | Tickets | Total Hours | Deadline |
|---|---|---|---|
| **MVP Sprint** | 01–07 | ~13.5 hrs | Tue 11:59 PM CT |
| **Feature Expansion** | 08–12 | ~12 hrs | Fri 11:59 PM CT |
| **Polish + Docs** | 13–15 | ~5.5 hrs | Sun 10:59 PM CT |
| **Buffer** | — | ~5 hrs | — |
| **Total** | 15 tickets | ~36 hrs | — |

The buffer is critical. Something will break — probably Yjs persistence or the AI agent's multi-step execution. Don't schedule yourself at 100% capacity.

---

## Working Rules

1. **One ticket at a time.** Never start TICKET-N+1 before TICKET-N is committed and pushed.
2. **Fresh Cursor chat per ticket.** Don't carry context drift from the previous ticket.
3. **Prime the agent.** Every chat starts with: "Read `@agents.md` and `@system-design.md`. I'm working on TICKET-XX."
4. **20-minute rule.** Stuck for 20 minutes → switch to Claude Code for a fresh perspective, or ask in Slack.
5. **Commit after every ticket.** Every commit on `main` must be deployable.
6. **Test sync constantly.** After every ticket that touches Yjs or Socket.io, open two browser tabs and verify.
7. **Update DEV-LOG.md after every ticket.** 60 seconds per entry. Don't defer to Sunday.
8. **Don't start AI agent before sync works.** Tickets 11-12 come after 01-07. No exceptions.
