# TICKET-06: Presence Awareness — Primer

**Use this to start TICKET-06 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @documentation/agents/agents.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-06: Presence Awareness.

Current state:
- ✅ TICKET-01 is COMPLETE (auth, board CRUD, deployed)
- ✅ TICKET-02 is COMPLETE (Konva canvas with pan/zoom)
- ✅ TICKET-03 is COMPLETE (Yjs Y.Map, WebSocket provider, Socket.io server running)
- ✅ TICKET-04 is COMPLETE (sticky notes with CRUD via Yjs)
- ✅ TICKET-05 is COMPLETE (multiplayer cursors via Socket.io, board sharing)
- ✅ Yjs WebsocketProvider initialized in Canvas.tsx
- ✅ Each user has a unique color (getUserColor(userId) hash function in Canvas.tsx)
- ✅ board_members table exists in Supabase for shared board access

What's NOT done yet:
- ❌ No Yjs awareness state set on connect
- ❌ No PresenceBar component showing online users
- ❌ No user count indicator
- ❌ No auto-removal when user disconnects

TICKET-06 Goal:
Use the Yjs awareness protocol (already built into y-websocket) to track who is currently
online on a board. Each client publishes their identity to the awareness state on connect.
All clients receive the full list of online users in real time. Display this as a presence
bar showing user avatars/colored dots and a user count. When a user disconnects, the
awareness protocol automatically removes them — no timeout logic needed.

Check @documentation/architecture/system-design.md for the awareness state schema.
After completion, follow the TICKET-06 testing checklist in @documentation/testing/TESTS.md.
```

---

## Quick Reference

**Time Budget:** 1 hour  
**Branch:** `feat/presence` (create new branch from `feat/multiplayer-cursors`)  
**Dependencies:** TICKET-01, TICKET-02, TICKET-03, TICKET-04, TICKET-05 — all complete

---

## Objective

Show who is currently online on a board using the Yjs awareness protocol. Each user sees colored avatars for every other active user. The list updates automatically when users join or leave — no polling, no custom server logic.

---

## What Already Exists

### Yjs Provider (from TICKET-03)

**`lib/yjs/provider.ts`** — WebsocketProvider already initialized in Canvas.tsx:
```typescript
// Canvas.tsx already stores the provider in state:
const [provider, setProvider] = useState<WebsocketProvider | null>(null);
```

The `WebsocketProvider` from `y-websocket` has a built-in `awareness` object:
```typescript
provider.awareness  // ← Yjs Awareness instance, ready to use
```

### User Color (from TICKET-05)

**`Canvas.tsx`** already has:
```typescript
function getUserColor(userId: string): string { ... } // hash → one of 8 colors
const [userColor, setUserColor] = useState<string>('#3b82f6');
const sessionUserIdRef = useRef<string>('');
const sessionUserNameRef = useRef<string>('Anonymous');
```

These are set on mount — reuse them for awareness state.

---

## What to Build

### 1. Set Awareness State on Connect

When the provider connects and the session is loaded, publish the current user's
presence to the awareness protocol:

```typescript
// In Canvas.tsx, after provider and session are ready:
useEffect(() => {
  if (!provider || !sessionUserIdRef.current) return;

  provider.awareness.setLocalStateField('user', {
    userId: sessionUserIdRef.current,
    userName: sessionUserNameRef.current,
    color: userColor,
    isOnline: true,
  });

  return () => {
    // Yjs awareness auto-clears on disconnect — no manual cleanup needed
    provider.awareness.setLocalState(null);
  };
}, [provider, userColor]); // re-run when provider or color is ready
```

### 2. Types

Add to `types/presence.ts` (create this file):

```typescript
export interface AwarenessUser {
  userId: string;
  userName: string;
  color: string;
  isOnline: boolean;
}

export interface AwarenessState {
  user?: AwarenessUser;
}
```

### 3. `components/board/PresenceBar.tsx`

A client component that subscribes to awareness changes and renders online users.

**Props:**
```typescript
interface PresenceBarProps {
  provider: WebsocketProvider;
  currentUserId: string;
}
```

**Behavior:**
- Subscribe to `provider.awareness.on('change', ...)` 
- Build list of online users from `provider.awareness.getStates()`
- Each state has shape `{ user: AwarenessUser }`
- Filter out entries with no `user` field (local states without identity set)
- Render colored avatar circles with tooltips showing username
- Show count badge: "2 online"

**Visual Design:**
- Fixed position: top-right of the board page (below the Share button)
- Overlapping avatar circles (like GitHub's contributor avatars)
- Each avatar: colored circle with first letter of username
- Count badge if more than 3 users
- Tooltip on hover showing full username

**Example:**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import type { AwarenessUser } from '@/types/presence';

export function PresenceBar({ provider, currentUserId }: PresenceBarProps) {
  const [onlineUsers, setOnlineUsers] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    const updatePresence = () => {
      const states = Array.from(provider.awareness.getStates().values());
      const users = states
        .map((state) => (state as { user?: AwarenessUser }).user)
        .filter((user): user is AwarenessUser => !!user);
      setOnlineUsers(users);
    };

    provider.awareness.on('change', updatePresence);
    updatePresence(); // Initial load

    return () => {
      provider.awareness.off('change', updatePresence);
    };
  }, [provider]);

  return (
    <div className="absolute top-16 right-4 z-10 flex items-center gap-2">
      {/* Avatar stack */}
      <div className="flex -space-x-2">
        {onlineUsers.slice(0, 5).map((user) => (
          <div
            key={user.userId}
            title={user.userName}
            style={{ backgroundColor: user.color }}
            className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold ${
              user.userId === currentUserId ? 'ring-2 ring-offset-1 ring-gray-400' : ''
            }`}
          >
            {user.userName[0]?.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Count badge */}
      <span className="text-xs text-gray-500 font-medium">
        {onlineUsers.length} online
      </span>
    </div>
  );
}
```

### 4. Wire PresenceBar into Canvas

```typescript
// In Canvas.tsx render section, after the Share button:
{provider && sessionUserIdRef.current && (
  <PresenceBar
    provider={provider}
    currentUserId={sessionUserIdRef.current}
  />
)}
```

---

## Data Flow

```
User opens board
  ↓
WebsocketProvider connects
  ↓
useEffect sets awareness local state: { user: { userId, userName, color, isOnline: true } }
  ↓
y-websocket broadcasts awareness to all clients in room
  ↓
All clients' awareness 'change' event fires
  ↓
PresenceBar re-reads awareness.getStates()
  ↓
Online user list updates
  ↓
Avatars render

User closes browser
  ↓
WebsocketProvider disconnects
  ↓
y-websocket server automatically removes their awareness entry
  ↓
All remaining clients' 'change' event fires
  ↓
User removed from PresenceBar within ~3 seconds
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `components/board/PresenceBar.tsx` | Online users avatar bar |
| `types/presence.ts` | AwarenessUser and AwarenessState types |

## Files to Modify

| File | Changes |
|------|---------|
| `components/board/Canvas.tsx` | Set awareness state on connect, render PresenceBar |

---

## Acceptance Criteria (from PRD)

- [ ] Opening a board shows the current user in the presence bar
- [ ] Opening the same board in a second browser (different account) shows both users
- [ ] Closing one browser removes that user from the presence bar within 3 seconds
- [ ] Each user has a distinct color (same color as their cursor)
- [ ] User count displayed

---

## Technical Gotchas

### 1. Awareness vs Yjs Doc

The awareness protocol is **separate** from the Y.Doc. It's ephemeral (not persisted) and
synced via the same WebSocket connection. Access it via `provider.awareness`, not `yDoc`.

### 2. `getStates()` Returns a Map

```typescript
provider.awareness.getStates()
// Returns: Map<clientId (number), state (object)>
// Each state has shape: { user?: AwarenessUser }
// The clientId is a random number, NOT the userId
```

Always use `Array.from(states.values())` to iterate.

### 3. Local Client Included

`getStates()` includes the local client's own awareness state. This is fine — it means
the current user will also appear in the presence bar (showing themselves is expected,
unlike cursors where you hide yourself).

Optionally highlight the current user with a ring/border to distinguish them.

### 4. Provider May Be Null Initially

The `provider` in Canvas.tsx state starts as `null` (set async in `initSync`). Only
render the PresenceBar and set awareness state after the provider is non-null.

### 5. useEffect Dependency: `userColor`

The awareness `setLocalStateField` effect depends on `userColor` (which is set async
after the session loads). Make sure the effect re-runs when `userColor` changes, or the
awareness state might be set with the default color `#3b82f6` before the real color loads.

The cleanest approach: trigger the awareness set inside the same `initSession` effect
that sets `userColor`, after both `provider` and `session` are available.

### 6. Staggered Awareness

The awareness protocol has a brief (~3 second) delay for cleanup on disconnect (server-side
heartbeat). This is expected behavior — no need to add a manual timeout.

---

## Architecture Rules (Non-Negotiable)

1. **Yjs awareness for presence** — never use Socket.io or Supabase for presence
2. **Ephemeral** — awareness state is never persisted to the database
3. **Same color as cursor** — reuse `getUserColor(userId)` for consistency
4. **Auto-cleanup** — rely on Yjs awareness protocol for disconnect handling, not manual timeouts

---

## Testing Strategy

### Manual Testing Checklist (5 min)

**Single Browser:**
- [ ] Open board → see own avatar in presence bar
- [ ] Count shows "1 online"
- [ ] Avatar shows first letter of username with correct color

**Multi-Browser (Critical):**
- [ ] Open same board in 2 browsers (different accounts via Share link)
- [ ] Both see 2 avatars in presence bar
- [ ] Count shows "2 online"
- [ ] Each avatar has the correct color (matching their cursor color)
- [ ] Close Browser A → Browser B updates to "1 online" within 3 seconds
- [ ] Reopen Browser A → count goes back to 2

### Playwright E2E (from TESTS.md)
```typescript
test('presence updates when users join/leave', async ({ browser }) => {
  const page1 = await browser.newPage();
  await page1.goto('/board/123');
  
  await expect(page1.locator('.presence-bar')).toContainText('1');
  
  const page2 = await browser.newPage();
  await page2.goto('/board/123');
  
  await expect(page1.locator('.presence-bar')).toContainText('2');
  await expect(page2.locator('.presence-bar')).toContainText('2');
  
  await page2.close();
  await expect(page1.locator('.presence-bar')).toContainText('1', { timeout: 5000 });
});
```

---

## Environment Reminder

**Client dev server:** `npm run dev` (port 3000)  
**WebSocket server:** run `npm run dev` in the `server/` folder (port 4000)  
**Both must be running** for awareness sync to work.

**Test:** Open `http://localhost:3000` in normal Chrome + Incognito with different accounts,
navigate both to the same board URL (use the Share button from TICKET-05).

---

## Suggested Implementation Order

1. Create `types/presence.ts`
2. Create `PresenceBar.tsx` (hardcode test data first to verify UI)
3. Add awareness `setLocalStateField` in Canvas.tsx (after provider + session ready)
4. Wire `PresenceBar` into Canvas.tsx render
5. Test single browser — verify own avatar appears
6. Test two browsers — verify both avatars appear with correct colors
7. Test disconnect — verify cleanup within 3 seconds

---

## Prompt Seed

> Read `@documentation/agents/agents.md` and `@documentation/architecture/system-design.md`.
> I'm working on TICKET-06: Presence Awareness. The Yjs WebsocketProvider is already
> initialized in Canvas.tsx and stored in `provider` state. Create a `PresenceBar.tsx`
> component that subscribes to `provider.awareness` changes and displays online user avatars.
> In Canvas.tsx, after both provider and session are ready, call
> `provider.awareness.setLocalStateField('user', { userId, userName, color, isOnline: true })`.
> Use the same `getUserColor(userId)` function already in Canvas.tsx for color consistency.
> Add `types/presence.ts` for the AwarenessUser type. Test with 2 browsers on the same board.
