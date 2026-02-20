# TICKET-13.1: Zoom Interaction Hardening - Primer

**Use this to start TICKET-13.1 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/requirements/PRD.md, @documentation/testing/TESTS.md, and @documentation/tickets/TICKET-13-PRIMER.md.

I'm working on TICKET-13.1: Zoom Interaction Hardening.

Current state:
- ✅ TICKET-13 is complete (performance hardening, reconnect/persistence lifecycle improvements, and performance HUD)
- ✅ Multi-select + marquee selection + group drag are implemented
- ✅ Board performance indicators are visible and updating in-app

TICKET-13.1 Goal:
Improve zoom in/out quality so interactions feel seamless on both mouse wheel and trackpad, while preserving all existing board behavior.

Primary implementation paths:
- @components/board/Canvas.tsx (wheel handling, pointer-anchor math, state update cadence)
- @stores/ui-store.ts (add a single viewport write path for zoom+pan)
- @components/board/Grid.tsx (temporary zoom-time simplification if needed)
- @tests/unit/ (zoom math/clamp/coalescing helper coverage)
- @tests/integration/ (regression confidence for board interactions)

Constraints:
- Keep Yjs as source of truth for board objects
- No auth/realtime architecture changes
- No `any` types
- Preserve pan, selection, draw, AI commands, and multi-select/group-drag behavior
- Keep min/max zoom clamp and pointer-anchored zoom behavior

After implementation:
- Run automated tests and type checks
- Run focused manual zoom validation on dense boards
- Update DEV-LOG with before/after feel + tuning values used
```

---

## Quick Reference

**Time Budget:** 45-75 minutes  
**Branch:** `main` (or a short-lived feature branch)  
**Dependencies:** TICKET-13 completion

---

## Objective

Improve zoom interaction quality without changing board semantics:
1. Faster, smoother zoom response
2. Stable pointer-anchored zooming
3. Reduced jitter under rapid wheel/trackpad input
4. No regressions to existing canvas flows

---

## Scope Details

### Functional changes

- Replace fixed-step zoom with wheel-delta-based zoom curve
- Coalesce wheel updates using `requestAnimationFrame`
- Batch viewport writes into one update (`zoom + pan`) where practical
- Keep zoom clamp range and pointer-anchor behavior intact

### UX/performance hardening

- Reduce rerender churn during continuous zoom gestures
- Optionally reduce grid work while active zooming
- Keep behavior smooth on dense boards (500+ objects)

---

## Technical Notes / Constraints

- Do not change Yjs ownership or persistence flow
- Avoid introducing extra async work in the zoom hot path
- Keep zoom logic deterministic and testable
- Keep keyboard shortcuts and pointer tools unaffected

---

## Testing Checklist

### Manual
1. Trackpad zoom feels responsive and natural in both directions
2. Mouse wheel zoom feels responsive and consistent
3. Pointer anchor remains stable (no drift/jump during zoom)
4. Rapid alternating zoom directions does not heavily jitter
5. Dense board remains usable while zooming
6. Pan/select/draw/multi-select/group-drag behavior is unchanged

### Automated
- Add unit coverage for zoom curve/clamp/anchor helper logic
- Keep existing regression suites green

---

## Acceptance Criteria

- ✅ Zoom interactions feel clearly smoother/faster than current baseline
- ✅ No regressions to existing board interactions
- ✅ Automated tests and type checks pass
- ✅ DEV-LOG entry includes tuning choices and validation summary
