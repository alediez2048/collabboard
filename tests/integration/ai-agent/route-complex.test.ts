import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai-agent/executor', () => ({
  executeToolCalls: vi.fn(),
}));

vi.mock('@/lib/ai-agent/tracing', () => ({
  createTracedCompletion: vi.fn(),
  startCommandTrace: vi.fn(),
  setCommandTraceExecutionPath: vi.fn(),
  recordCommandTraceEvent: vi.fn(),
  finishCommandTrace: vi.fn(),
}));

vi.mock('openai', () => {
  function MockOpenAI() {
    return {};
  }
  return { default: MockOpenAI };
});

import { createClient } from '@/lib/supabase/server';
import { executeToolCalls } from '@/lib/ai-agent/executor';
import {
  createTracedCompletion,
  startCommandTrace,
  setCommandTraceExecutionPath,
  finishCommandTrace,
} from '@/lib/ai-agent/tracing';
import { POST } from '@/app/api/ai/command/route';

const mockCreateClient = vi.mocked(createClient);
const mockExecute = vi.mocked(executeToolCalls);
const mockTracing = vi.mocked(createTracedCompletion);
const mockStartTrace = vi.mocked(startCommandTrace);
const mockSetTracePath = vi.mocked(setCommandTraceExecutionPath);
const mockFinishTrace = vi.mocked(finishCommandTrace);

const mockTraceContext = {
  traceId: 'trace-complex-1',
  traceName: 'ai-board-command',
  boardId: 'board-1',
  userId: 'user-123',
  command: 'Create a SWOT analysis',
  startedAtMs: 0,
  executionPath: 'unknown',
  events: [],
};

function makeAuthenticatedSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      }),
    },
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/ai/command', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/ai/command complex planning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockStartTrace.mockReturnValue(mockTraceContext as never);
    mockFinishTrace.mockResolvedValue(undefined);
  });

  it('gets board state first for SWOT template, then runs planned steps without OpenAI call', async () => {
    mockExecute.mockResolvedValue({
      success: true,
      actions: [
        { tool: 'createFrame', args: { title: 'Strengths' }, result: 'Affected: frame-1' },
        { tool: 'createFrame', args: { title: 'Weaknesses' }, result: 'Affected: frame-2' },
      ],
      objectsAffected: ['frame-1', 'frame-2'],
      toolOutputs: [{
        toolCallId: 'call-state',
        tool: 'getBoardState',
        output: { totalObjects: 0, returnedCount: 0, objects: [] },
      }],
    });
    mockExecute.mockResolvedValueOnce({
      success: true,
      actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 0 of 0 objects' }],
      objectsAffected: [],
      toolOutputs: [{
        toolCallId: 'call-state',
        tool: 'getBoardState',
        output: { totalObjects: 0, returnedCount: 0, objects: [] },
      }],
    });
    mockExecute.mockResolvedValueOnce({
      success: true,
      actions: [
        { tool: 'createFrame', args: { title: 'Strengths' }, result: 'Affected: frame-1' },
        { tool: 'createStickyNote', args: { text: 'Strengths' }, result: 'Affected: sticky-1' },
      ],
      objectsAffected: ['frame-1', 'sticky-1'],
      toolOutputs: [],
    });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Create a SWOT analysis' }),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    const firstCallArgs = mockExecute.mock.calls[0]?.[0] ?? [];
    expect(firstCallArgs[0]?.function?.name).toBe('getBoardState');
    expect(mockTracing).not.toHaveBeenCalled();
    expect(mockSetTracePath).toHaveBeenCalledWith(mockTraceContext, 'deterministic-planner');
    expect(mockFinishTrace).toHaveBeenCalledWith(
      mockTraceContext,
      expect.objectContaining({ success: true }),
    );
  });

  it('uses getBoardState first for layout command, then executes layout mutation steps', async () => {
    mockExecute
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 2 of 2 objects' }],
        objectsAffected: [],
        toolOutputs: [{
          toolCallId: 'call-state',
          tool: 'getBoardState',
          output: {
            totalObjects: 2,
            returnedCount: 2,
            objects: [
              {
                id: 'note-1',
                type: 'sticky_note',
                x: 100,
                y: 100,
                width: 200,
                height: 200,
                rotation: 0,
                zIndex: 1,
                properties: {},
                createdBy: 'user-1',
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'note-2',
                type: 'sticky_note',
                x: 500,
                y: 100,
                width: 200,
                height: 200,
                rotation: 0,
                zIndex: 2,
                properties: {},
                createdBy: 'user-1',
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        }],
      })
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'moveObject', args: { objectId: 'note-1', x: 100, y: 100 }, result: 'Affected: note-1' }],
        objectsAffected: ['note-1', 'note-2'],
        toolOutputs: [],
      });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Arrange these sticky notes in a grid' }),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockTracing).not.toHaveBeenCalled();
  });

  it('routes high-count generation commands through deterministic planner path', async () => {
    mockExecute.mockResolvedValueOnce({
      success: true,
      actions: Array.from({ length: 100 }, (_, index) => ({
        tool: 'createStickyNote',
        args: { text: `Item ${index + 1}`, x: 100, y: 100, color: '#ffeb3b' },
        result: `Affected: note-${index + 1}`,
      })),
      objectsAffected: Array.from({ length: 100 }, (_, index) => `note-${index + 1}`),
      toolOutputs: [],
    });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Generate 100 objects' }),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const plannedCalls = mockExecute.mock.calls[0]?.[0] ?? [];
    expect(plannedCalls).toHaveLength(100);
    expect(plannedCalls.every((call: { function?: { name?: string } }) => call.function?.name === 'createStickyNote')).toBe(true);
    expect(mockTracing).not.toHaveBeenCalled();
    expect(mockSetTracePath).toHaveBeenCalledWith(mockTraceContext, 'deterministic-planner');
  });

  it('routes 1000-note command through deterministic planner path with exact count', async () => {
    mockExecute.mockResolvedValueOnce({
      success: true,
      actions: Array.from({ length: 1000 }, (_, index) => ({
        tool: 'createStickyNote',
        args: { text: `Item ${index + 1}`, x: 100, y: 100, color: '#a3e635' },
        result: `Affected: note-${index + 1}`,
      })),
      objectsAffected: Array.from({ length: 1000 }, (_, index) => `note-${index + 1}`),
      toolOutputs: [],
    });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Add 1000 green sticky notes' }),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const plannedCalls = mockExecute.mock.calls[0]?.[0] ?? [];
    expect(plannedCalls).toHaveLength(1000);
    expect(plannedCalls.every((call: { function?: { name?: string } }) => call.function?.name === 'createStickyNote')).toBe(true);
    expect(mockTracing).not.toHaveBeenCalled();
  });

  it('routes ambiguous "create 1000" commands through deterministic sticky-note planning', async () => {
    mockExecute.mockResolvedValueOnce({
      success: true,
      actions: Array.from({ length: 1000 }, (_, index) => ({
        tool: 'createStickyNote',
        args: { text: `Item ${index + 1}`, x: 100, y: 100, color: '#ffeb3b' },
        result: `Affected: note-${index + 1}`,
      })),
      objectsAffected: Array.from({ length: 1000 }, (_, index) => `note-${index + 1}`),
      toolOutputs: [],
    });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Create 1000' }),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const plannedCalls = mockExecute.mock.calls[0]?.[0] ?? [];
    expect(plannedCalls).toHaveLength(1000);
    expect(plannedCalls.every((call: { function?: { name?: string } }) => call.function?.name === 'createStickyNote')).toBe(true);
    expect(mockTracing).not.toHaveBeenCalled();
  });

  it('routes bulk arrow commands through deterministic line-shape planning', async () => {
    mockExecute.mockResolvedValueOnce({
      success: true,
      actions: Array.from({ length: 1000 }, (_, index) => ({
        tool: 'createShape',
        args: {
          type: 'line',
          x: 120,
          y: 120,
          width: 220,
          height: 120,
          color: '#1d4ed8',
        },
        result: `Affected: line-${index + 1}`,
      })),
      objectsAffected: Array.from({ length: 1000 }, (_, index) => `line-${index + 1}`),
      toolOutputs: [],
    });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Add 1000 arrows' }),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const plannedCalls = mockExecute.mock.calls[0]?.[0] ?? [];
    expect(plannedCalls).toHaveLength(1000);
    expect(plannedCalls.every((call: { function?: { name?: string } }) => call.function?.name === 'createShape')).toBe(true);
    expect(mockTracing).not.toHaveBeenCalled();
  });

  it('routes number-word sticky-note bulk commands through deterministic planner path', async () => {
    mockExecute.mockResolvedValueOnce({
      success: true,
      actions: Array.from({ length: 50 }, (_, index) => ({
        tool: 'createStickyNote',
        args: { text: `Item ${index + 1}`, x: 100, y: 100, color: '#ffeb3b' },
        result: `Affected: note-${index + 1}`,
      })),
      objectsAffected: Array.from({ length: 50 }, (_, index) => `note-${index + 1}`),
      toolOutputs: [],
    });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Add fifty sticky notes for ideas' }),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const plannedCalls = mockExecute.mock.calls[0]?.[0] ?? [];
    expect(plannedCalls).toHaveLength(50);
    expect(mockTracing).not.toHaveBeenCalled();
  });

  it('routes "ones" phrasing through deterministic planner path with exact count', async () => {
    mockExecute.mockResolvedValueOnce({
      success: true,
      actions: Array.from({ length: 100 }, (_, index) => ({
        tool: 'createStickyNote',
        args: { text: `Item ${index + 1}`, x: 100, y: 100, color: '#a3e635' },
        result: `Affected: note-${index + 1}`,
      })),
      objectsAffected: Array.from({ length: 100 }, (_, index) => `note-${index + 1}`),
      toolOutputs: [],
    });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Add 100 green ones afterwards' }),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const plannedCalls = mockExecute.mock.calls[0]?.[0] ?? [];
    expect(plannedCalls).toHaveLength(100);
    expect(plannedCalls.every((call: { function?: { name?: string } }) => call.function?.name === 'createStickyNote')).toBe(true);
    expect(mockTracing).not.toHaveBeenCalled();
  });

  it('tops up missing objects when deterministic bulk execution under-produces', async () => {
    mockExecute
      .mockResolvedValueOnce({
        success: true,
        actions: Array.from({ length: 10 }, (_, index) => ({
          tool: 'createStickyNote',
          args: { text: `Item ${index + 1}`, x: 100, y: 100, color: '#a3e635' },
          result: `Affected: note-${index + 1}`,
        })),
        objectsAffected: Array.from({ length: 10 }, (_, index) => `note-${index + 1}`),
        toolOutputs: [],
      })
      .mockResolvedValueOnce({
        success: true,
        actions: Array.from({ length: 90 }, (_, index) => ({
          tool: 'createStickyNote',
          args: { text: `Item ${index + 11}`, x: 100, y: 100, color: '#a3e635' },
          result: `Affected: note-${index + 11}`,
        })),
        objectsAffected: Array.from({ length: 90 }, (_, index) => `note-${index + 11}`),
        toolOutputs: [],
      });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Add 100 green ones afterwards' }),
    );
    const body = await response.json() as {
      success: boolean;
      objectsAffected: string[];
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(body.objectsAffected).toHaveLength(100);
  });

  it('runs Kanban verification and issues corrective steps when layout checks fail', async () => {
    mockExecute
      // Initial board-state read required by planner.
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 2 of 2 objects' }],
        objectsAffected: [],
        toolOutputs: [{
          toolCallId: 'call-state',
          tool: 'getBoardState',
          output: {
            totalObjects: 2,
            returnedCount: 2,
            objects: [
              {
                id: 'note-1',
                type: 'sticky_note',
                x: 100,
                y: 120,
                width: 220,
                height: 220,
                rotation: 0,
                zIndex: 1,
                properties: { text: 'One', color: '#ffeb3b' },
                createdBy: 'user-1',
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'note-2',
                type: 'sticky_note',
                x: 420,
                y: 180,
                width: 220,
                height: 220,
                rotation: 0,
                zIndex: 2,
                properties: { text: 'Two', color: '#ffeb3b' },
                createdBy: 'user-1',
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        }],
      })
      // Initial deterministic execution pass.
      .mockResolvedValueOnce({
        success: true,
        actions: [
          { tool: 'createFrame', args: { title: 'To Do' }, result: 'Affected: frame-1' },
          { tool: 'createFrame', args: { title: 'In Progress' }, result: 'Affected: frame-2' },
          { tool: 'createFrame', args: { title: 'Done' }, result: 'Affected: frame-3' },
          { tool: 'resizeObject', args: { objectId: 'note-1', width: 180, height: 120 }, result: 'Affected: note-1' },
          { tool: 'moveObject', args: { objectId: 'note-1', x: 136, y: 176 }, result: 'Affected: note-1' },
          { tool: 'resizeObject', args: { objectId: 'note-2', width: 180, height: 120 }, result: 'Affected: note-2' },
          { tool: 'moveObject', args: { objectId: 'note-2', x: 496, y: 176 }, result: 'Affected: note-2' },
        ],
        objectsAffected: ['frame-1', 'frame-2', 'frame-3', 'note-1', 'note-1', 'note-2', 'note-2'],
        toolOutputs: [],
      })
      // Verification read returns drifted notes and missing frames.
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 2 of 2 objects' }],
        objectsAffected: [],
        toolOutputs: [{
          toolCallId: 'call-verify',
          tool: 'getBoardState',
          output: {
            totalObjects: 2,
            returnedCount: 2,
            objects: [
              {
                id: 'note-1',
                type: 'sticky_note',
                x: 20,
                y: 30,
                width: 260,
                height: 260,
                rotation: 0,
                zIndex: 1,
                properties: { text: 'One', color: '#ffeb3b' },
                createdBy: 'user-1',
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'note-2',
                type: 'sticky_note',
                x: 40,
                y: 40,
                width: 260,
                height: 260,
                rotation: 0,
                zIndex: 2,
                properties: { text: 'Two', color: '#ffeb3b' },
                createdBy: 'user-1',
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        }],
      })
      // Corrective pass.
      .mockResolvedValueOnce({
        success: true,
        actions: [
          { tool: 'createFrame', args: { title: 'To Do' }, result: 'Affected: frame-4' },
          { tool: 'resizeObject', args: { objectId: 'note-1', width: 180, height: 120 }, result: 'Affected: note-1' },
          { tool: 'moveObject', args: { objectId: 'note-1', x: 136, y: 176 }, result: 'Affected: note-1' },
        ],
        objectsAffected: ['frame-4', 'note-1', 'note-1'],
        toolOutputs: [],
      });

    const response = await POST(
      makeRequest({
        boardId: 'board-1',
        command: 'Create a kanban board with springboards and resize all sticky notes and get them inside the kanban board',
      }),
    );
    const body = await response.json() as {
      success: boolean;
      actions: Array<{ tool: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(4);
    expect(mockTracing).not.toHaveBeenCalled();

    const correctionCall = mockExecute.mock.calls[3]?.[0] ?? [];
    expect(correctionCall.some((call: { function?: { name?: string } }) => call.function?.name === 'createFrame')).toBe(true);
    expect(correctionCall.some((call: { function?: { name?: string } }) => call.function?.name === 'resizeObject')).toBe(true);
    expect(correctionCall.some((call: { function?: { name?: string } }) => call.function?.name === 'moveObject')).toBe(true);
    expect(body.actions.some((action) => action.tool === 'createFrame')).toBe(true);
  });
});
