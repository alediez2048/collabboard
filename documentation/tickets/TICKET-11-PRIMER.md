# TICKET-11: AI Agent — Basic Commands — Primer

**Use this to start TICKET-11 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-11: AI Agent — Basic Commands.

Current state:
- ✅ TICKET-01 through TICKET-10 are complete and merged to main
- ✅ Board objects are the Yjs source of truth in a shared Y.Map named "objects"
- ✅ Objects currently supported: sticky_note, rectangle, circle, line, connector, frame
- ✅ Canvas interactions (draw, drag, resize, rotate) already write through updateObject() and sync in real-time
- ✅ Persistence snapshots already restore board state after refresh/reconnect
- ✅ Viewport persistence (zoom + pan) is already implemented per board in localStorage

TICKET-11 Goal:
Add a production-safe AI command path so users can type natural language commands
and have the model execute board mutations through typed tools. All AI writes must
flow through Yjs (same sync path as manual edits), never direct canvas mutation or
direct database writes.

Required implementation paths:
- @components/board/AICommandBar.tsx
- @app/api/ai/command/route.ts
- @lib/ai-agent/tools.ts
- @lib/ai-agent/scoped-state.ts
- @lib/ai-agent/executor.ts

After completion, follow the TICKET-11 testing checklist.
```

---

## Quick Reference

**Time Budget:** 3 hours  
**Branch:** `feat/ai-basic` (create from `main`)  
**Dependencies:** TICKET-04, TICKET-08, TICKET-10  

---

## Objective

Build the first AI command loop:
1. User submits command in `AICommandBar`
2. API route calls OpenAI with function/tool calling
3. Model selects tool calls
4. Executor applies tool calls to Yjs doc
5. Updates sync to all connected clients automatically

---

## Scope Details

### Tool definitions (`lib/ai-agent/tools.ts`)

Implement typed tool schemas for:
- `createStickyNote(text, x, y, color)`
- `createShape(type, x, y, width, height, color)`
- `createFrame(title, x, y, width, height)`
- `createConnector(fromId, toId, style)`
- `moveObject(objectId, x, y)`
- `updateText(objectId, newText)`
- `changeColor(objectId, color)`
- `getBoardState()` (scoped, max 50 objects)

### Scoped board context (`lib/ai-agent/scoped-state.ts`)

- Return command-relevant object subset only
- Hard cap: 50 objects
- Include summary fields:
  - `totalObjects`
  - `returnedCount`
- Never pass full 500+ object boards to the model

### Tool execution (`lib/ai-agent/executor.ts`)

- Validate all tool args server-side
- Write changes via Yjs helpers (`addObject`, `updateObject`, etc.)
- Return structured results including affected object IDs
- Use try/catch with typed error handling

### API route (`app/api/ai/command/route.ts`)

- Validate request payload `{ boardId, command }`
- Authenticate user session
- Build system prompt constraints for board-only behavior
- Call OpenAI function calling flow
- Execute returned tool calls sequentially
- Return:
  - `success`
  - `actions`
  - `objectsAffected`
  - `error` (if any)

### UI (`components/board/AICommandBar.tsx`)

- Bottom command bar on board page
- Submit on Enter / button click
- Show loading state while AI runs
- Show result or error feedback

---

## Technical Notes / Constraints

- Yjs remains source of truth for board objects
- Zustand remains local-only UI state
- No `any` types
- `getBoardState()` must stay capped at 50 objects
- Single-step commands should complete in under 2 seconds
- Add tracing for OpenAI calls (LangSmith or Langfuse):
  - prompt
  - response
  - latency
  - tokens
  - cost

---

## Testing Checklist (Manual + Automated)

### Manual
1. "Add a yellow sticky note that says User Research" creates correct note
2. "Create a blue rectangle at position 100, 200" creates shape with expected properties
3. "Move all the pink sticky notes to the right side" moves target objects
4. "Change the sticky note color to green" updates color
5. Open second browser/account: AI changes sync in real time
6. Hard refresh: AI-created/modified objects persist
7. Confirm loading indicator appears while command is running

### Automated (Vitest)
- Tool schema/validation tests
- Scoped-state cap and filtering tests
- Executor tests for each tool path
- API route success/failure tests (payload + auth + execution errors)

---

## Acceptance Criteria

- ✅ 6+ distinct command types work end-to-end
- ✅ AI mutations write to Yjs and sync across clients
- ✅ Response time < 2s for single-step commands
- ✅ `getBoardState()` is scoped and capped at 50 objects
- ✅ Traces visible in LangSmith/Langfuse for AI calls
