import { describe, expect, it } from 'vitest';
import { planComplexCommand, verifyPlanExecution } from '@/lib/ai-agent/planner';
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

  it('supports brainstorm template commands with deterministic seeded notes', () => {
    const firstPass = planComplexCommand('Create a brainstorm board');
    expect(firstPass).not.toBeNull();
    expect(firstPass?.requiresBoardState).toBe(true);
    expect(firstPass?.steps).toHaveLength(0);

    const planned = planComplexCommand('Create a brainstorm board', makeScopedState([]));
    expect(planned).not.toBeNull();
    expect(planned?.requiresBoardState).toBe(false);

    const stickySteps = (planned?.steps ?? []).filter((step) => step.tool === 'createStickyNote');
    expect(stickySteps.length).toBeGreaterThanOrEqual(8);
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

  it('builds a deterministic bulk sticky-note plan for high-count generation commands', () => {
    const plan = planComplexCommand('Generate 100 objects');
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);
    expect(plan?.steps).toHaveLength(100);
    expect((plan?.steps ?? []).every((step) => step.tool === 'createStickyNote')).toBe(true);
  });

  it('supports 1000-note deterministic bulk generation without truncation', () => {
    const plan = planComplexCommand('Add 1000 green sticky notes');
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);
    expect(plan?.steps).toHaveLength(1000);
    expect((plan?.steps ?? []).every((step) => step.tool === 'createStickyNote')).toBe(true);
  });

  it('defaults ambiguous high-count commands to deterministic sticky-note generation', () => {
    const plan = planComplexCommand('Create 1000');
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);
    expect(plan?.steps).toHaveLength(1000);
    expect((plan?.steps ?? []).every((step) => step.tool === 'createStickyNote')).toBe(true);
  });

  it('builds deterministic line-shape plans for bulk arrow commands', () => {
    const plan = planComplexCommand('Add 1000 arrows');
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);
    expect(plan?.steps).toHaveLength(1000);
    expect((plan?.steps ?? []).every((step) => step.tool === 'createShape')).toBe(true);
    expect((plan?.steps ?? []).every((step) => step.args.type === 'line')).toBe(true);
  });

  it('caps extremely large bulk generation requests at 5000 notes', () => {
    const plan = planComplexCommand('Add 9999 sticky notes');
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);
    expect(plan?.steps).toHaveLength(5000);
  });

  it('parses number-word bulk sticky-note commands into deterministic plans', () => {
    const plan = planComplexCommand('Add fifty sticky notes for brainstorm ideas');
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);
    expect(plan?.steps).toHaveLength(50);
  });

  it('treats "ones" phrasing as bulk sticky-note generation for consistency', () => {
    const plan = planComplexCommand('Add 100 green ones afterwards');
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);
    expect(plan?.steps).toHaveLength(100);
    const colors = new Set((plan?.steps ?? []).map((step) => String(step.args.color)));
    expect(colors).toEqual(new Set(['#a3e635']));
  });

  it('does not hijack explicit shape-creation commands as sticky-note bulk plans', () => {
    const plan = planComplexCommand('Create 50 circles');
    expect(plan).toBeNull();
  });

  it('marks Kanban setup as requiring board state before arranging existing notes', () => {
    const plan = planComplexCommand(
      'Create a kanban board with springboards and resize all sticky notes and get them inside the kanban board',
    );
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(true);
    expect(plan?.steps).toHaveLength(0);
  });

  it('builds deterministic Kanban frame + sticky resize/move steps when board state is present', () => {
    const boardState = makeScopedState([
      makeObject({ id: 'note-1', x: 80, y: 120, width: 220, height: 220 }),
      makeObject({ id: 'note-2', x: 340, y: 180, width: 220, height: 220 }),
      makeObject({ id: 'note-3', x: 620, y: 210, width: 220, height: 220 }),
    ]);

    const plan = planComplexCommand(
      'Create a kanban board with springboards and resize all sticky notes and get them inside the kanban board',
      boardState,
    );
    expect(plan).not.toBeNull();
    expect(plan?.requiresBoardState).toBe(false);

    const frameSteps = (plan?.steps ?? []).filter((step) => step.tool === 'createFrame');
    const resizeSteps = (plan?.steps ?? []).filter((step) => step.tool === 'resizeObject');
    const moveSteps = (plan?.steps ?? []).filter((step) => step.tool === 'moveObject');

    expect(frameSteps).toHaveLength(3);
    expect(resizeSteps).toHaveLength(3);
    expect(moveSteps).toHaveLength(3);
    expect(plan?.verification?.type).toBe('kanban-layout');
    expect(plan?.verification?.stickyPlacements).toHaveLength(3);
  });

  it('returns corrective Kanban steps when post-layout verification fails', () => {
    const sourceState = makeScopedState([
      makeObject({ id: 'note-1', x: 120, y: 120, width: 220, height: 220 }),
      makeObject({ id: 'note-2', x: 420, y: 120, width: 220, height: 220 }),
    ]);
    const plan = planComplexCommand(
      'Create a kanban board with springboards and resize all sticky notes and get them inside the kanban board',
      sourceState,
    );
    expect(plan).not.toBeNull();

    const driftedState = makeScopedState([
      makeObject({ id: 'note-1', x: 30, y: 30, width: 260, height: 260 }),
      makeObject({ id: 'note-2', x: 60, y: 50, width: 260, height: 260 }),
    ]);

    const verification = verifyPlanExecution(plan!, driftedState);
    expect(verification.passed).toBe(false);
    expect(verification.issues.length).toBeGreaterThan(0);
    expect(verification.correctiveSteps.some((step) => step.tool === 'createFrame')).toBe(true);
    expect(verification.correctiveSteps.some((step) => step.tool === 'resizeObject')).toBe(true);
    expect(verification.correctiveSteps.some((step) => step.tool === 'moveObject')).toBe(true);
  });
});
