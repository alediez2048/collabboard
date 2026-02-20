import { describe, expect, it } from 'vitest';
import { createThrottle } from '@/lib/sync/throttle';

describe('createThrottle', () => {
  it('runs the first call immediately and drops calls within interval', () => {
    const now = 1000;
    const calls: number[] = [];
    const throttled = createThrottle(
      (value: number) => {
        calls.push(value);
      },
      50,
      () => now,
    );

    throttled(1);
    throttled(2);
    throttled(3);

    expect(calls).toEqual([1]);
  });

  it('allows a new call once interval has elapsed', () => {
    let now = 1000;
    const calls: number[] = [];
    const throttled = createThrottle(
      (value: number) => {
        calls.push(value);
      },
      50,
      () => now,
    );

    throttled(10);
    now = 1049;
    throttled(20);
    now = 1050;
    throttled(30);

    expect(calls).toEqual([10, 30]);
  });
});
