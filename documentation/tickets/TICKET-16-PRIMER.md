# TICKET-16: High-Object Performance Deep Dive - Primer

**Use this to start TICKET-16 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, @documentation/tickets/TICKET-13-PRIMER.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-16: High-Object Performance Deep Dive.

Current state:
- ✅ TICKET-01 through TICKET-15 are complete on main
- ✅ Core collaboration features are stable (Yjs object sync + Socket.io cursors + persistence)
- ✅ Existing performance hardening is in place, but dense boards still feel slow beyond a certain object threshold

TICKET-16 Goal:
Improve runtime performance specifically for large boards so canvas interaction remains smooth with high object counts.
Focus on:
1) pan/zoom FPS at scale
2) object selection/drag/transform responsiveness at scale
3) connector/frame-heavy board rendering performance
4) measurable before/after evidence

Primary implementation + validation paths:
- @components/board/Canvas.tsx
- @components/board/Grid.tsx
- @components/board/Connector.tsx
- @components/board/RemoteCursorsLayer.tsx
- @components/board/PerformanceHUD.tsx
- @lib/utils/viewport-culling.ts
- @lib/utils/multi-select-drag.ts
- @lib/sync/throttle.ts
- @server/src/yjs-server.ts
- @server/src/persistence.ts
- @tests/unit/viewport-culling.test.ts
- @tests/unit/multi-select-drag.test.ts
- @tests/unit/performance-indicators.test.ts
- @tests/integration/yjs-sync.test.ts
- @documentation/tickets/DEV-LOG.md
- @documentation/tickets/TICKETS.md

Constraints:
- Keep Yjs as the single source of truth for board objects
- Keep cursor events ephemeral via Socket.io
- No `any` types
- Preserve behavior and UX correctness while optimizing
- No direct board-object writes to Postgres (persistence remains snapshot-based through Yjs)

After implementation:
- Run lint/build/tests/E2E
- Run dense-board benchmark scenarios (500, 1000, 2000 objects)
- Record before/after metrics in DEV-LOG
- Mark TICKET-16 completion in tracker
```

---

## Quick Reference

**Time Budget:** 3-4 hours  
**Branch:** `feat/perf-high-object-scale` (or short-lived branch from `main`)  
**Dependencies:** TICKET-13 through TICKET-15

---

## Objective

Ship a dedicated performance pass for dense boards:
1. Keep canvas interactions smooth under high object counts
2. Reduce heavy render/update work on non-visible objects
3. Preserve multiplayer sync responsiveness while board density increases
4. Produce benchmark evidence for submission/interview confidence

---

## Scope Details

### 1) Baseline profiling for dense boards

- Measure current baseline on representative boards (500, 1000, 2000 objects)
- Capture:
  - pan/zoom FPS
  - drag/selection responsiveness
  - object sync latency
  - cursor sync latency
- Add lightweight instrumentation only where needed to compare before/after

### 2) Render-path optimization

- Tighten viewport culling and visible-object derivation in the canvas render pipeline
- Ensure expensive connector/frame computations are minimized and reused
- Reduce avoidable recomputation caused by stage pan/zoom updates
- Verify Konva node churn is bounded under frequent updates

### 3) Interaction scaling optimization

- Optimize selection/multi-select and drag update paths for large object sets
- Ensure transform/selection logic does not degrade into full-board scans each frame
- Keep editing/overlay behavior responsive under load

### 4) Realtime load resilience

- Validate Yjs observer/update handling remains stable with high mutation volume
- Confirm cursor throughput remains in 20-30Hz target without render starvation
- Re-check reconnect and persistence behavior under dense-board load

### 5) Guardrails and regression prevention

- Add or extend focused unit/integration tests for new optimization helpers/paths
- Keep behavior identical from a user perspective (no feature regressions)
- Document measurable performance improvements in DEV-LOG

---

## Technical Notes / Constraints

- State ownership must remain unchanged:
  - persistent board objects -> Yjs
  - ephemeral cursors -> Socket.io
  - local UI-only state -> Zustand
- Keep strict TypeScript typing and explicit error handling
- Prefer targeted optimizations over broad architectural rewrites
- Maintain compatibility with existing AI mutation flow and multiplayer behavior

---

## Testing / Verification Checklist

### Manual
1. Load board with ~500 objects; validate smooth pan/zoom and object interactions.
2. Load board with ~1000 objects; verify interaction quality is still acceptable/smooth.
3. Load board with ~2000 objects; verify no major stalls/crashes and usable interactivity.
4. In two browsers, mutate objects on dense board; verify sync remains stable and timely.
5. Verify cursor behavior remains smooth and does not flood updates.
6. Restart/reconnect server path; verify recovery and persistence correctness.

### Automated
- Add/extend tests around:
  - viewport culling behavior at large object counts
  - multi-select drag update efficiency/correctness
  - performance indicator calculations
  - Yjs sync stress paths in integration tests
- Keep full regression green:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`
  - `npm run build --prefix server` (if server touched)

---

## Acceptance Criteria

- ✅ Dense-board performance is measurably improved versus baseline (before/after documented)
- ✅ Pan/zoom and object interactions remain smooth on boards with 1000+ objects
- ✅ No regressions to multiplayer sync, persistence, or AI board mutation behavior
- ✅ Full regression checks remain green after optimization changes
- ✅ DEV-LOG contains concrete benchmark evidence and optimization summary
