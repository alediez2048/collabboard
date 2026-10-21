# Testing

## Automated

| Layer | Tool | Where | In CI |
|---|---|---|---|
| Unit | Vitest | `tests/unit/` | Yes |
| Integration (API routes, Yjs sync, AI agent) | Vitest | `tests/integration/` | Yes |
| Realtime server access checks | Vitest | `tests/unit/server/` | Yes |
| End to end | Playwright | `tests/e2e/` | No, needs a live Supabase project |

`npm test` runs the Vitest suites (about 320 tests). CI (`.github/workflows/ci.yml`) runs lint, a typecheck and those tests on every push, and builds the realtime server. The dense-board benchmark test is skipped in CI because it measures wall-clock time and is unreliable on shared runners.

What the Vitest suites cover:

- Board document model: sticky notes, shapes, connectors, frames, freehand, transforms, multi-select drag
- Viewport culling, zoom and viewport persistence
- Yjs sync and persistence, presence, cursor throttling
- Dashboard: discovery, navigation, thumbnails, starring, templates
- AI agent: tool definitions, planner, executor, layout, scoped board state, the `/api/ai/command` route including access and input checks
- Realtime server: only a board's owner or members can join its Yjs document or Socket.io room

## Manual checks before a release

1. Open the same board in two browsers signed in as different members; edits, cursors and presence show up in both within a second.
2. Refresh one browser; the board comes back as it was.
3. Open the board's link while signed in as a non-member: you're asked to join, and you can't see the board before joining.
4. Run a few AI commands ("add a yellow sticky note", "make a kanban board") and check the result on the canvas.
