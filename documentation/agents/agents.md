# CollabBoard — Agent Context

## What We're Building
A real-time collaborative whiteboard (like Miro) with an AI agent that manipulates the board via natural language.

## Architecture Summary
- Board object state lives in a Yjs shared document (Y.Map), synced via y-websocket
- Cursor positions are broadcast via Socket.io (ephemeral, not persisted)
- Persistence: Yjs doc snapshots are debounced to Supabase Postgres every 500ms
- Auth: Supabase Auth (JWT sessions)
- AI agent writes to the Yjs doc — same sync path as manual edits

## Architecture Priorities (in order)
1. Multiplayer sync must be bulletproof — Yjs CRDT handles conflict resolution automatically
2. State persistence — Yjs snapshots survive all users leaving
3. Performance — 60fps during pan/zoom, <100ms object sync, <50ms cursor sync
4. AI agent — single-step tool calls first, multi-step second

## Critical Constraints
- Must support 5+ concurrent users without degradation
- Must handle 500+ objects without performance drops
- Must handle network disconnection and reconnection gracefully (Yjs handles this natively)
- AI agent changes must write to the Yjs shared document, not bypass it
- Cursor events must be throttled to 20-30Hz on the sender side
- getBoardState() for AI must be scoped — never send more than 50 objects
- Deployment must be publicly accessible with authentication

## DO NOT
- Use `any` types
- Skip error handling on WebSocket events
- Implement AI agent before multiplayer sync works
- Store board objects in Zustand — Yjs is the single source of truth
- Write board objects directly to Postgres — always go through Yjs
- Send unthrottled cursor events
- Pass the entire board (500+ objects) to the AI agent in one call
