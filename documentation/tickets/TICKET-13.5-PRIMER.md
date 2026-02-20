# TICKET-13.5: LLM Observability + Dashboard Readiness - Primer

**Use this to start TICKET-13.5 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @documentation/agents/agents.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, @documentation/tickets/TICKET-13-PRIMER.md, and @documentation/tickets/TICKET-13.1-PRIMER.md.

I'm working on TICKET-13.5: LLM Observability + Dashboard Readiness.

Current state:
- ✅ TICKET-13 and TICKET-13.1 are complete with additional performance follow-up hardening
- ✅ AI path includes deterministic planner execution for complex commands and bulk sticky-note generation
- ✅ AI executor supports bridge batch mutation with fallback to sequential mutation
- ✅ Route has consistency guards to top-up under-produced deterministic bulk runs
- ✅ Performance HUD now shows zoom speed, pan drag FPS, and AI prompt execution time
- ✅ Tracing adapter exists in lib/ai-agent/tracing.ts and is already used by /api/ai/command

TICKET-13.5 Goal:
Make AI behavior fully traceable and explainable in Langfuse/LangSmith dashboards for demo/interview readiness.

Primary implementation + validation paths:
- @lib/ai-agent/tracing.ts
- @app/api/ai/command/route.ts
- @lib/ai-agent/planner.ts
- @lib/ai-agent/executor.ts
- @server/src/ai-routes.ts
- @.env.example
- @documentation/tickets/DEV-LOG.md

Constraints:
- Keep Yjs as source of truth for board objects
- No auth or websocket architecture changes
- No `any` types
- Do not regress deterministic bulk sticky-note behavior or count consistency
- Keep tracing non-blocking (never break command flow if tracing backend is down)

After implementation:
- Run automated tests and build checks
- Validate traces for success and failure flows in Langfuse/LangSmith
- Add trace evidence and interpretation notes to DEV-LOG
```

---

## Quick Reference

**Time Budget:** 60-90 minutes  
**Branch:** `main` (or short-lived feature branch)  
**Dependencies:** TICKET-11 through TICKET-13.1 completion

---

## Objective

Ship observability that answers:
1. What prompt and tool calls were executed?
2. How long did each AI command take end-to-end?
3. What token/cost profile did each command produce?
4. Can we explain both successful and failed command traces quickly?

---

## Scope Details

### Trace coverage to confirm (or improve)

- Single-step command path (`ai-board-command`)
- `getBoardState` follow-up path (`ai-board-command-followup`)
- Deterministic planner path (complex templates + bulk sticky-note generation)
- Executor batch-mutate path and fallback behavior
- Failure/error path traces (invalid args, bridge errors, fallback conditions)

### Dashboard readiness outcomes

- At least one clean trace example per major AI path
- One documented failure trace with root-cause explanation
- Stable naming/metadata conventions so traces are easy to scan
- DEV-LOG evidence (trace IDs/links/screenshots + short interpretation)

---

## Technical Notes / Constraints

- Tracing must remain best-effort and non-blocking.
- Avoid adding latency to hot paths just for instrumentation.
- Do not remove deterministic routing for high-count bulk sticky-note commands.
- Keep bridge fallback behavior intact when batch endpoint response is non-JSON/HTML.
- Keep environment setup explicit in `.env.example` for both Langfuse and LangSmith.

---

## Testing Checklist

### Manual
1. Run a simple command (`add one sticky note`) and verify trace appears.
2. Run a follow-up-dependent command (`move that note to x 500 y 300`) and verify trace includes board-state then mutation behavior.
3. Run deterministic bulk command (`add 100 green sticky notes`) and verify trace clarity on planner/executor path.
4. Trigger one controlled failure path and verify trace is still captured and understandable.
5. Confirm AI prompt execution HUD value is directionally consistent with traced latency (rough sanity check).

### Automated
- Keep AI route/unit/integration suites green:
  - `tests/unit/ai-agent/*.test.ts`
  - `tests/integration/ai-agent/route.test.ts`
  - `tests/integration/ai-agent/route-complex.test.ts`
- Keep full project regression green (`npm test`, `npm run build`, server build if changed).

---

## Acceptance Criteria

- ✅ Traces appear reliably for all primary AI command classes.
- ✅ At least one success and one failure trace can be explained end-to-end.
- ✅ Trace metadata includes enough latency/tokens/cost context for analysis.
- ✅ No regressions to AI command behavior, especially deterministic bulk creation consistency.
- ✅ DEV-LOG includes concrete observability evidence and interpretation notes.

