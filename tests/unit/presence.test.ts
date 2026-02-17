import { describe, it, expect } from 'vitest';
import type { AwarenessUser, AwarenessState } from '@/types/presence';

// ---------------------------------------------------------------------------
// Pure helper — mirrors the extraction logic inside PresenceBar
// ---------------------------------------------------------------------------
function extractOnlineUsers(
  statesMap: Map<number, Record<string, unknown>>,
): AwarenessUser[] {
  return Array.from(statesMap.values())
    .map((state) => (state as AwarenessState).user)
    .filter((user): user is AwarenessUser => !!user);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Presence awareness state extraction', () => {
  it('returns an empty array when there are no awareness states', () => {
    const states = new Map<number, Record<string, unknown>>();
    expect(extractOnlineUsers(states)).toEqual([]);
  });

  it('returns an empty array when all states lack a user field', () => {
    const states = new Map<number, Record<string, unknown>>([
      [1, {}],
      [2, { cursor: { x: 0, y: 0 } }],
    ]);
    expect(extractOnlineUsers(states)).toEqual([]);
  });

  it('extracts a single online user correctly', () => {
    const user: AwarenessUser = {
      userId: 'user-abc',
      userName: 'Alice',
      color: '#ef4444',
      isOnline: true,
    };

    const states = new Map<number, Record<string, unknown>>([[42, { user }]]);
    const result = extractOnlineUsers(states);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(user);
  });

  it('extracts multiple online users from multiple client slots', () => {
    const alice: AwarenessUser = {
      userId: 'user-alice',
      userName: 'Alice',
      color: '#ef4444',
      isOnline: true,
    };
    const bob: AwarenessUser = {
      userId: 'user-bob',
      userName: 'Bob',
      color: '#10b981',
      isOnline: true,
    };

    const states = new Map<number, Record<string, unknown>>([
      [1, { user: alice }],
      [2, { user: bob }],
    ]);

    const result = extractOnlineUsers(states);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(alice);
    expect(result).toContainEqual(bob);
  });

  it('skips states without a user field while keeping valid ones', () => {
    const carol: AwarenessUser = {
      userId: 'user-carol',
      userName: 'Carol',
      color: '#8b5cf6',
      isOnline: true,
    };

    const states = new Map<number, Record<string, unknown>>([
      [1, {}],                           // no user field
      [2, { user: carol }],              // valid
      [3, { cursor: { x: 10, y: 20 } }], // no user field
    ]);

    const result = extractOnlineUsers(states);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(carol);
  });

  it('each user has all required AwarenessUser fields', () => {
    const user: AwarenessUser = {
      userId: 'user-xyz',
      userName: 'Dave',
      color: '#f59e0b',
      isOnline: true,
    };

    const states = new Map<number, Record<string, unknown>>([[99, { user }]]);
    const [extracted] = extractOnlineUsers(states);

    expect(extracted).toHaveProperty('userId');
    expect(extracted).toHaveProperty('userName');
    expect(extracted).toHaveProperty('color');
    expect(extracted).toHaveProperty('isOnline');
  });

  it('supports 5+ concurrent users', () => {
    const userColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    const states = new Map<number, Record<string, unknown>>(
      userColors.map((color, i) => [
        i,
        {
          user: {
            userId: `user-${i}`,
            userName: `User${i}`,
            color,
            isOnline: true,
          } satisfies AwarenessUser,
        },
      ]),
    );

    const result = extractOnlineUsers(states);
    expect(result).toHaveLength(6);
    result.forEach((u) => {
      expect(u.isOnline).toBe(true);
    });
  });
});

describe('AwarenessState type', () => {
  it('allows a state with no user field (partial state)', () => {
    const state: AwarenessState = {};
    expect(state.user).toBeUndefined();
  });

  it('allows a state with a fully populated user field', () => {
    const user: AwarenessUser = {
      userId: 'u1',
      userName: 'Test',
      color: '#06b6d4',
      isOnline: true,
    };
    const state: AwarenessState = { user };
    expect(state.user).toEqual(user);
  });
});
