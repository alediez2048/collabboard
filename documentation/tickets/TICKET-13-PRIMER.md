# TICKET-13: Performance Profiling + Hardening — Primer

**Use this to start TICKET-13 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @AGENTS.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-13: Performance Profiling + Hardening.

Current state:
- ✅ TICKET-01 through TICKET-12 are complete and merged to main
- ✅ Multiplayer sync is running through Yjs + y-websocket for board objects
- ✅ Ephemeral cursor sync uses Socket.io with sender throttling
- ✅ AI complex planning is implemented with deterministic sequencing and collision-safe placement
- ✅ Realtime bridge writes AI mutations to live Yjs docs

TICKET-13 Goal:
Profile and harden production behavior so the app remains stable and performant
under higher object counts, multiple collaborators, and reconnect/disconnect conditions.

Primary implementation + validation paths:
- @components/board/Canvas.tsx (rendering/interaction perf checks)
- @components/board/Cursors.tsx (cursor perf + smoothing behavior)
- @lib/sync/throttle.ts (ensure sender throttle remains in target range)
- @lib/yjs/provider.ts (connection lifecycle + reconnect robustness)
- @server/src/yjs-server.ts (doc lifecycle + update flow)
- @server/src/persistence.ts (snapshot timing/throughput under load)
- @tests/integration/yjs-sync.test.ts (extend stress/reconnect coverage)
- @tests/e2e/ (add focused perf/resilience smoke where feasible)

After completion, run TICKET-13 manual and automated checklists and record measured numbers in DEV-LOG.
```

---

## Quick Reference

**Time Budget:** 2 hours  
**Branch:** `feat/performance` (create from `main`)  
**Dependencies:** TICKET-01 through TICKET-12

---

## Objective

Measure, validate, and harden:
1. Canvas interaction smoothness
2. Realtime sync latency
3. Stability at higher object counts
4. Behavior across disconnect/reconnect
5. Recovery correctness after server interruption

---

## Scope Details

### Performance targets to verify

- 60fps during pan/zoom/object interaction
- `<100ms` object sync latency between collaborators
- `<50ms` cursor sync latency
- 500+ objects without major degradation
- 5+ concurrent users without major degradation

### Hardening checks

- Validate reconnect behavior after websocket interruption/restart
- Confirm Yjs state convergence after reconnect
- Ensure persistence snapshots continue to save/load correctly under load
- Confirm no critical console/server errors during stress scenarios

### Optimization directions (only if needed)

- Reduce unnecessary Konva redraw work
- Ensure cursor event throttle remains bounded (20–30Hz)
- Confirm no excessive Yjs update churn from non-critical paths
- Add targeted guards/instrumentation for noisy hotspots

---

## Technical Notes / Constraints

- Yjs remains source of truth for board objects
- Do not move board state into Zustand
- Keep cursor events ephemeral via Socket.io (not persisted)
- Preserve auth and bridge safety constraints
- No `any` types; use typed guards and try/catch on external boundaries
- Avoid architecture changes unless metrics prove they are necessary

---

## Testing Checklist (Manual + Automated)

### Manual
1. Pan/zoom board with dense object set; verify interaction remains smooth
2. Measure object sync latency between two browser sessions (`<100ms` target)
3. Measure cursor sync latency (`<50ms` target)
4. Load board with 500+ objects; verify app remains usable and stable
5. Simulate websocket server restart; verify clients reconnect and state recovers
6. Confirm persistence after reconnect + refresh

### Automated
- Extend integration tests for Yjs sync under repeated updates
- Add reconnect/disconnect lifecycle test coverage
- Keep existing AI/board regression suites green

---

## Acceptance Criteria

- ✅ Performance targets measured and documented in `documentation/tickets/DEV-LOG.md`
- ✅ App remains stable with 500+ objects and multi-user activity
- ✅ Disconnect/reconnect recovers live collaboration without data loss
- ✅ No regressions introduced to prior ticket functionality
