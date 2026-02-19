import { describe, expect, it } from 'vitest';
import { planComplexCommand } from '@/lib/ai-agent/planner';
import type { ScopedBoardState } from '@/lib/ai-agent/scoped-state';
import type { BoardObject } from '@/lib/yjs/board-doc';

function makeObject(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: crypto.randomUUID(),
    type: 'sticky_note',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    rotation: 0,
    zIndex: 1,
    properties: { text: 'hello', color: '#ffeb3b' },
    createdBy: 'user-1',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeScopedState(objects: BoardObject[]): ScopedBoardState {
  return {
    totalObjects: objects.length,
    returnedCount: objects.length,
    objects,
  };
}

describe('planComplexCommand', () => {
  it('marks SWOT template as requiring board state before planning placement', () => {
    const plan = planComplexCommand('Create a SWOT analysis');
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(true);
    expect(plan?.steps).toHaveLength(0);
  });

  it('creates SWOT as a 2x2 quadrant layout with sticky headers', () => {
    const plan = planComplexCommand('Create a SWOT analysis', makeScopedState([]));
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);

    const frameSteps = (plan?.steps ?? []).filter((step) => step.tool === 'createFrame');
    const stickySteps = (plan?.steps ?? []).filter((step) => step.tool === 'createStickyNote');
    expect(frameSteps).toHaveLength(4);
    expect(stickySteps).toHaveLength(4);

    const uniqueX = new Set(frameSteps.map((step) => Number(step.args.x)));
    const uniqueY = new Set(frameSteps.map((step) => Number(step.args.y)));
    expect(uniqueX.size).toBe(2);
    expect(uniqueY.size).toBe(2);
  });

  it('creates user journey map using sticky notes with multiple colors', () => {
    const plan = planComplexCommand('Build a user journey map with 5 stages', makeScopedState([]));
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);

    const stickySteps = (plan?.steps ?? []).filter((step) => step.tool === 'createStickyNote');
    expect(stickySteps).toHaveLength(10);

    const colors = new Set(stickySteps.map((step) => String(step.args.color)));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('marks sticky-note grid arrangement as requiring board state before planning', () => {
    const plan = planComplexCommand('Arrange these sticky notes in a grid');
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(true);
    expect(plan?.steps).toHaveLength(0);
  });

  it('builds moveObject steps after board state is provided for grid arrangement', () => {
    const boardState = makeScopedState([
      makeObject({ id: 'n1', x: 50, y: 40 }),
      makeObject({ id: 'n2', x: 350, y: 40 }),
      makeObject({ id: 'n3', x: 650, y: 40 }),
      makeObject({ id: 'n4', x: 950, y: 40 }),
    ]);

    const plan = planComplexCommand('Arrange these sticky notes in a grid', boardState);
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);
    expect(plan?.steps).toHaveLength(4);
    expect(plan?.steps.every((step) => step.tool === 'moveObject')).toBe(true);
  });

  it('places new templates away from occupied board regions', () => {
    const boardState = makeScopedState([
      makeObject({
        id: 'occupied',
        type: 'frame',
        x: 120,
        y: 120,
        width: 1800,
        height: 1200,
      }),
    ]);

    const plan = planComplexCommand('Create a SWOT analysis', boardState);
    expect(plan).not.toBeNull();
    const minX = Math.min(
      ...(plan?.steps ?? []).map((step) => Number(step.args.x ?? 0)),
    );
    expect(minX).toBeGreaterThanOrEqual(1920);
  });

  it('returns null for non-complex command', () => {
    const plan = planComplexCommand('Add one yellow sticky note at x 100 y 100');
    expect(plan).toBeNull();
  });
});
