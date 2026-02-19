# TICKET-12: AI Agent — Complex Commands — Primer

**Use this to start TICKET-12 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-12: AI Agent — Complex Commands.

Current state:
- ✅ TICKET-01 through TICKET-11 are complete and merged to main
- ✅ TICKET-11 already supports AI basic commands through typed tools and realtime bridge execution
- ✅ Existing object commands now support a second-pass follow-up after getBoardState
- ✅ AI writes flow through realtime server -> live Yjs docs -> collaborator sync path
- ✅ Tool validation and integration tests exist for route + executor

TICKET-12 Goal:
Implement multi-step AI command execution for complex board setup and layout actions
while preserving production-safe Yjs mutation flow, auth checks, and observability.

Required implementation paths (proposed):
- @app/api/ai/command/route.ts (extend orchestration loop; keep API contract stable)
- @lib/ai-agent/tools.ts (add/extend tools for complex layout, including resizeObject)
- @lib/ai-agent/executor.ts (support new tool paths + deterministic sequencing)
- @lib/ai-agent/scoped-state.ts (keep scoped context contract; improve relevance ranking if needed)
- @lib/ai-agent/planner.ts (new: planning/step representation and sequencing helpers)
- @lib/ai-agent/layout.ts (new: deterministic layout/grid/spacing utilities)
- @tests/unit/ai-agent/planner.test.ts
- @tests/unit/ai-agent/layout.test.ts
- @tests/integration/ai-agent/route-complex.test.ts

After completion, run the TICKET-12 manual and automated checklists.
```

---

## Quick Reference

**Time Budget:** 2.5 hours  
**Branch:** `feat/ai-complex` (create from `main`)  
**Dependencies:** TICKET-11  

---

## Objective

Build reliable multi-step AI command execution:
1. Parse complex user intent (template setup, layout, spacing, multi-object actions)
2. Create a deterministic step plan
3. Execute step-by-step through typed tools
4. Keep all writes on Yjs path via realtime bridge
5. Return structured progress/results in one response

---

## Scope Details

### Complex command templates

Support template-style prompts such as:
- "Create a SWOT analysis"
- "Build a user journey map with 5 stages"
- "Set up a retrospective board with What Went Well, What Didn't, Action Items"

Expected behavior:
- Build frames/headers/seed notes in predictable positions
- Use deterministic spacing, sizing, and naming
- Complete in one command request (multi-step internally)

### Layout commands

Support layout prompts such as:
- "Arrange these sticky notes in a grid"
- "Create a 2x3 grid of sticky notes for pros and cons"
- "Space these elements evenly"

Expected behavior:
- Consistent spacing
- No overlaps unless explicitly requested
- Respect board coordinates and existing objects

### Tooling additions

Add/extend tools in `lib/ai-agent/tools.ts`:
- `resizeObject(objectId, width, height)` (required by PRD)
- Keep existing tools from TICKET-11
- Keep strict server-side arg validation and typed results

### Planner + sequencer

Create lightweight planning layer (can be internal helpers, not heavy framework):
- Represent plan as ordered steps
- Execute sequentially (no parallel tool execution)
- Halt on step failure and return partial action history
- Keep response contract stable: `success`, `actions`, `objectsAffected`, `error`

### Orchestration boundary (important)

Preserve the seam already established in TICKET-11:
- `route.ts` orchestrates AI loop
- `executor.ts` performs validated tool execution
- This seam should remain clean so future LangChain-style orchestration can plug in without API changes

---

## Technical Notes / Constraints

- Yjs remains source of truth for board objects
- Zustand remains local-only UI state (no board object duplication)
- Keep `getBoardState()` scoped and capped (max 50 objects per call)
- Keep execution strictly sequential
- No `any` types; use typed guards
- Use try/catch around external calls and bridge calls
- Keep single-step/basic behavior backward-compatible
- Target complex command completion under 5 seconds (PRD guidance)

---

## Observability References

Use these references while implementing tracing/planning visibility:
- LangChain JS docs: `https://js.langchain.com/docs/introduction/`
- LangSmith docs: `https://docs.smith.langchain.com/`
- Langfuse docs: `https://langfuse.com/docs`
- Langfuse TypeScript SDK: `https://langfuse.com/docs/sdk/typescript`
- OpenAI function/tool calling: `https://platform.openai.com/docs/guides/function-calling`

Track for each complex command:
- high-level plan steps
- per-step tool call + args + result
- latency per step and total request latency
- token usage / cost summary

---

## Testing Checklist (Manual + Automated)

### Manual
1. "Create a SWOT analysis" produces 4 labeled quadrants/sections
2. "Build a user journey map with 5 stages" creates 5-column structure
3. "Arrange these sticky notes in a grid" aligns objects with consistent spacing
4. "Space these elements evenly" recalculates positions predictably
5. Two browser sessions: complex AI command syncs in real time
6. Hard refresh: generated structures persist
7. Verify existing TICKET-11 commands still work unchanged

### Automated (Vitest)
- Planner unit tests for step generation and edge cases
- Layout utility tests (grid/spacing math)
- Executor tests for new `resizeObject` path
- Route integration tests for multi-step success/failure and rollback behavior
- Regression tests for TICKET-11 commands

---

## Acceptance Criteria

- ✅ "Create a SWOT analysis" produces 4 labeled quadrants
- ✅ "Arrange in a grid" aligns elements with consistent spacing
- ✅ Multi-step commands execute sequentially without errors
- ✅ Complex commands complete in <5 seconds
- ✅ Multiple users can issue AI commands simultaneously without conflict (Yjs conflict-safe writes)
