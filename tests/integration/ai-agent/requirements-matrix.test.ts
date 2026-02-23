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
  finishCommandTrace,
  startCommandTrace,
} from '@/lib/ai-agent/tracing';
import { POST } from '@/app/api/ai/command/route';

const mockCreateClient = vi.mocked(createClient);
const mockExecute = vi.mocked(executeToolCalls);
const mockTracing = vi.mocked(createTracedCompletion);
const mockStartTrace = vi.mocked(startCommandTrace);
const mockFinishTrace = vi.mocked(finishCommandTrace);

const traceContext = {
  traceId: 'trace-requirements-1',
  traceName: 'ai-board-command',
  boardId: 'board-1',
  userId: 'user-123',
  command: 'placeholder',
  startedAtMs: 0,
  executionPath: 'unknown',
  events: [],
};

interface ToolCallDefinition {
  name: string;
  args: Record<string, unknown>;
}

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

function makeRequest(command: string) {
  return new NextRequest('http://localhost/api/ai/command', {
    method: 'POST',
    body: JSON.stringify({ boardId: 'board-1', command }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeToolResponse(toolCalls: ToolCallDefinition[]) {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: toolCalls.map((toolCall, index) => ({
            id: `tool-${index + 1}`,
            type: 'function',
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.args),
            },
          })),
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 60, total_tokens: 180 },
  };
}

function buildStickyState(objects: Array<{ id: string; x: number; y: number; color?: string }>) {
  return {
    totalObjects: objects.length,
    returnedCount: objects.length,
    objects: objects.map((object, index) => ({
      id: object.id,
      type: 'sticky_note',
      x: object.x,
      y: object.y,
      width: 200,
      height: 200,
      rotation: 0,
      zIndex: index + 1,
      properties: { text: `Note ${index + 1}`, color: object.color ?? '#ffeb3b' },
      createdBy: 'user-123',
      updatedAt: new Date().toISOString(),
    })),
  };
}

describe('AI agent requirements matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test-key';
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockStartTrace.mockReturnValue(traceContext as never);
    mockFinishTrace.mockResolvedValue(undefined);
  });

  describe('Creation commands', () => {
    it('supports adding a yellow sticky note with user text', async () => {
      mockTracing.mockResolvedValueOnce(
        makeToolResponse([
          {
            name: 'createStickyNote',
            args: { text: 'User Research', x: 180, y: 220, color: '#ffeb3b' },
          },
        ]) as never,
      );
      mockExecute.mockResolvedValueOnce({
        success: true,
        actions: [
          {
            tool: 'createStickyNote',
            args: { text: 'User Research', x: 180, y: 220, color: '#ffeb3b' },
            result: 'Affected: note-1',
          },
        ],
        objectsAffected: ['note-1'],
        toolOutputs: [],
      });

      const response = await POST(makeRequest("Add a yellow sticky note that says 'User Research'"));
      const body = await response.json() as { success: boolean; objectsAffected: string[] };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.objectsAffected).toEqual(['note-1']);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute.mock.calls[0]?.[0]?.[0]?.function?.name).toBe('createStickyNote');
    });

    it('supports creating a blue rectangle at an explicit position', async () => {
      mockTracing.mockResolvedValueOnce(
        makeToolResponse([
          {
            name: 'createShape',
            args: {
              type: 'rectangle',
              x: 100,
              y: 200,
              width: 220,
              height: 140,
              color: '#60a5fa',
            },
          },
        ]) as never,
      );
      mockExecute.mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'createShape', args: { type: 'rectangle' }, result: 'Affected: rect-1' }],
        objectsAffected: ['rect-1'],
        toolOutputs: [],
      });

      const response = await POST(makeRequest('Create a blue rectangle at position 100, 200'));
      const body = await response.json() as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockExecute.mock.calls[0]?.[0]?.[0]?.function?.name).toBe('createShape');
    });

    it('supports adding a frame with a title', async () => {
      mockTracing.mockResolvedValueOnce(
        makeToolResponse([
          {
            name: 'createFrame',
            args: { title: 'Sprint Planning', x: 120, y: 120, width: 420, height: 320 },
          },
        ]) as never,
      );
      mockExecute.mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'createFrame', args: { title: 'Sprint Planning' }, result: 'Affected: frame-1' }],
        objectsAffected: ['frame-1'],
        toolOutputs: [],
      });

      const response = await POST(makeRequest("Add a frame called 'Sprint Planning'"));
      const body = await response.json() as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockExecute.mock.calls[0]?.[0]?.[0]?.function?.name).toBe('createFrame');
    });
  });

  describe('Manipulation commands', () => {
    it('uses deterministic planner + verification for moving all pink notes to the right side', async () => {
      mockExecute
        .mockResolvedValueOnce({
          success: true,
          actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 3 of 3 objects' }],
          objectsAffected: [],
          toolOutputs: [
            {
              toolCallId: 'tool-1',
              tool: 'getBoardState',
              output: buildStickyState([
                { id: 'pink-1', x: 120, y: 140, color: '#ec4899' },
                { id: 'pink-2', x: 200, y: 420, color: '#ec4899' },
                { id: 'blue-1', x: 500, y: 180, color: '#60a5fa' },
              ]),
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          actions: [
            { tool: 'moveObject', args: { objectId: 'pink-1', x: 1200, y: 140 }, result: 'Affected: pink-1' },
            { tool: 'moveObject', args: { objectId: 'pink-2', x: 1200, y: 356 }, result: 'Affected: pink-2' },
          ],
          objectsAffected: ['pink-1', 'pink-2'],
          toolOutputs: [],
        })
        .mockResolvedValueOnce({
          success: true,
          actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 3 of 3 objects' }],
          objectsAffected: [],
          toolOutputs: [
            {
              toolCallId: 'tool-verify',
              tool: 'getBoardState',
              output: buildStickyState([
                { id: 'pink-1', x: 1200, y: 140, color: '#ec4899' },
                { id: 'pink-2', x: 1200, y: 356, color: '#ec4899' },
                { id: 'blue-1', x: 500, y: 180, color: '#60a5fa' },
              ]),
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          actions: [],
          objectsAffected: [],
          toolOutputs: [],
        });

      const response = await POST(makeRequest('Move all the pink sticky notes to the right side'));
      const body = await response.json() as { success: boolean; objectsAffected: string[] };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockExecute.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(mockExecute.mock.calls[0]?.[0]?.[0]?.function?.name).toBe('getBoardState');
      expect(mockExecute.mock.calls[1]?.[0]?.every((call: { function: { name: string } }) => call.function.name === 'moveObject')).toBe(true);
      expect(mockTracing).not.toHaveBeenCalled();
    });

    it('supports resizing a frame after reading context', async () => {
      mockTracing
        .mockResolvedValueOnce(makeToolResponse([{ name: 'getBoardState', args: {} }]) as never)
        .mockResolvedValueOnce(
          makeToolResponse([
            { name: 'resizeObject', args: { objectId: 'frame-1', width: 1200, height: 720 } },
          ]) as never,
        );

      mockExecute
        .mockResolvedValueOnce({
          success: true,
          actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 1 of 1 objects' }],
          objectsAffected: [],
          toolOutputs: [
            {
              toolCallId: 'tool-1',
              tool: 'getBoardState',
              output: {
                totalObjects: 1,
                returnedCount: 1,
                objects: [
                  {
                    id: 'frame-1',
                    type: 'frame',
                    x: 120,
                    y: 120,
                    width: 600,
                    height: 360,
                    rotation: 0,
                    zIndex: 1,
                    properties: { title: 'Sprint Planning' },
                    createdBy: 'user-123',
                    updatedAt: new Date().toISOString(),
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          actions: [{ tool: 'resizeObject', args: { objectId: 'frame-1', width: 1200, height: 720 }, result: 'Affected: frame-1' }],
          objectsAffected: ['frame-1'],
          toolOutputs: [],
        });

      const response = await POST(makeRequest('Resize the frame to fit its contents'));
      const body = await response.json() as { success: boolean; objectsAffected: string[] };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.objectsAffected).toEqual(['frame-1']);
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute.mock.calls[1]?.[0]?.[0]?.function?.name).toBe('resizeObject');
    });

    it('supports changing sticky note color after reading context', async () => {
      mockTracing
        .mockResolvedValueOnce(makeToolResponse([{ name: 'getBoardState', args: {} }]) as never)
        .mockResolvedValueOnce(
          makeToolResponse([
            { name: 'changeColor', args: { objectId: 'sticky-1', color: '#22c55e' } },
          ]) as never,
        );

      mockExecute
        .mockResolvedValueOnce({
          success: true,
          actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 1 of 1 objects' }],
          objectsAffected: [],
          toolOutputs: [
            {
              toolCallId: 'tool-1',
              tool: 'getBoardState',
              output: buildStickyState([{ id: 'sticky-1', x: 200, y: 180, color: '#fef08a' }]),
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          actions: [{ tool: 'changeColor', args: { objectId: 'sticky-1', color: '#22c55e' }, result: 'Affected: sticky-1' }],
          objectsAffected: ['sticky-1'],
          toolOutputs: [],
        });

      const response = await POST(makeRequest('Change the sticky note color to green'));
      const body = await response.json() as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockExecute.mock.calls[1]?.[0]?.[0]?.function?.name).toBe('changeColor');
    });
  });

  describe('Layout and complex deterministic commands', () => {
    it('arranges notes in a grid with board-state-assisted moveObject steps', async () => {
      mockExecute
        .mockResolvedValueOnce({
          success: true,
          actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 4 of 4 objects' }],
          objectsAffected: [],
          toolOutputs: [
            {
              toolCallId: 'tool-1',
              tool: 'getBoardState',
              output: buildStickyState([
                { id: 'note-1', x: 100, y: 100 },
                { id: 'note-2', x: 520, y: 120 },
                { id: 'note-3', x: 200, y: 460 },
                { id: 'note-4', x: 640, y: 500 },
              ]),
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          actions: Array.from({ length: 4 }, (_, index) => ({
            tool: 'moveObject',
            args: { objectId: `note-${index + 1}`, x: 120 + (index % 2) * 240, y: 120 + Math.floor(index / 2) * 240 },
            result: `Affected: note-${index + 1}`,
          })),
          objectsAffected: ['note-1', 'note-2', 'note-3', 'note-4'],
          toolOutputs: [],
        });

      const response = await POST(makeRequest('Arrange these sticky notes in a grid'));
      const body = await response.json() as { success: boolean; objectsAffected: string[] };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.objectsAffected).toHaveLength(4);
      expect(mockTracing).not.toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute.mock.calls[1]?.[0]?.every((call: { function: { name: string } }) => call.function.name === 'moveObject')).toBe(true);
    });

    it('creates a 2x3 pros/cons sticky grid deterministically', async () => {
      mockExecute
        .mockResolvedValueOnce({
          success: true,
          actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 0 of 0 objects' }],
          objectsAffected: [],
          toolOutputs: [
            {
              toolCallId: 'tool-1',
              tool: 'getBoardState',
              output: { totalObjects: 0, returnedCount: 0, objects: [] },
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          actions: Array.from({ length: 6 }, (_, index) => ({
            tool: 'createStickyNote',
            args: {
              text: index < 3 ? `Pro ${index + 1}` : `Con ${index - 2}`,
              x: 120 + (index % 3) * 240,
              y: 120 + Math.floor(index / 3) * 240,
              color: index < 3 ? '#a3e635' : '#fca5a5',
            },
            result: `Affected: note-${index + 1}`,
          })),
          objectsAffected: Array.from({ length: 6 }, (_, index) => `note-${index + 1}`),
          toolOutputs: [],
        });

      const response = await POST(makeRequest('Create a 2x3 grid of sticky notes for pros and cons'));
      const body = await response.json() as { success: boolean; objectsAffected: string[] };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.objectsAffected).toHaveLength(6);
      expect(mockExecute.mock.calls[1]?.[0]).toHaveLength(6);
      expect(mockExecute.mock.calls[1]?.[0]?.every((call: { function: { name: string } }) => call.function.name === 'createStickyNote')).toBe(true);
      expect(mockTracing).not.toHaveBeenCalled();
    });

    it('spaces elements evenly through deterministic moveObject planning', async () => {
      mockExecute
        .mockResolvedValueOnce({
          success: true,
          actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 3 of 3 objects' }],
          objectsAffected: [],
          toolOutputs: [
            {
              toolCallId: 'tool-1',
              tool: 'getBoardState',
              output: {
                totalObjects: 3,
                returnedCount: 3,
                objects: [
                  {
                    id: 'item-1',
                    type: 'sticky_note',
                    x: 100,
                    y: 200,
                    width: 200,
                    height: 200,
                    rotation: 0,
                    zIndex: 1,
                    properties: {},
                    createdBy: 'user-123',
                    updatedAt: new Date().toISOString(),
                  },
                  {
                    id: 'item-2',
                    type: 'sticky_note',
                    x: 420,
                    y: 200,
                    width: 200,
                    height: 200,
                    rotation: 0,
                    zIndex: 2,
                    properties: {},
                    createdBy: 'user-123',
                    updatedAt: new Date().toISOString(),
                  },
                  {
                    id: 'item-3',
                    type: 'sticky_note',
                    x: 900,
                    y: 200,
                    width: 200,
                    height: 200,
                    rotation: 0,
                    zIndex: 3,
                    properties: {},
                    createdBy: 'user-123',
                    updatedAt: new Date().toISOString(),
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          actions: [
            { tool: 'moveObject', args: { objectId: 'item-1', x: 100, y: 200 }, result: 'Affected: item-1' },
            { tool: 'moveObject', args: { objectId: 'item-2', x: 500, y: 200 }, result: 'Affected: item-2' },
            { tool: 'moveObject', args: { objectId: 'item-3', x: 900, y: 200 }, result: 'Affected: item-3' },
          ],
          objectsAffected: ['item-1', 'item-2', 'item-3'],
          toolOutputs: [],
        });

      const response = await POST(makeRequest('Space these elements evenly'));
      const body = await response.json() as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockTracing).not.toHaveBeenCalled();
    });

    it('builds SWOT, journey, and retrospective templates with deterministic multi-step execution', async () => {
      const commands = [
        {
          command: 'Create a SWOT analysis template with four quadrants',
          expectedStepCount: 16,
          expectedPrimaryTool: 'createFrame',
        },
        {
          command: 'Build a user journey map with 5 stages',
          expectedStepCount: 10,
          expectedPrimaryTool: 'createStickyNote',
        },
        {
          command: "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns",
          expectedStepCount: 12,
          expectedPrimaryTool: 'createFrame',
        },
      ] as const;

      for (const entry of commands) {
        mockExecute
          .mockResolvedValueOnce({
            success: true,
            actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 0 of 0 objects' }],
            objectsAffected: [],
            toolOutputs: [
              {
                toolCallId: 'tool-1',
                tool: 'getBoardState',
                output: { totalObjects: 0, returnedCount: 0, objects: [] },
              },
            ],
          })
          .mockResolvedValueOnce({
            success: true,
            actions: Array.from({ length: entry.expectedStepCount }, (_, index) => ({
              tool: index === 0 ? entry.expectedPrimaryTool : 'createStickyNote',
              args: {},
              result: `Affected: obj-${index + 1}`,
            })),
            objectsAffected: Array.from({ length: entry.expectedStepCount }, (_, index) => `obj-${index + 1}`),
            toolOutputs: [],
          });

        const response = await POST(makeRequest(entry.command));
        const body = await response.json() as { success: boolean; objectsAffected: string[] };

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.objectsAffected).toHaveLength(entry.expectedStepCount);

        const secondPassCalls = mockExecute.mock.calls.at(-1)?.[0] ?? [];
        expect(secondPassCalls).toHaveLength(entry.expectedStepCount);
      }
    });
  });

  describe('Performance and reliability requirements', () => {
    it('completes single-step creation commands under 2 seconds in the route layer', async () => {
      mockTracing.mockResolvedValueOnce(
        makeToolResponse([
          {
            name: 'createStickyNote',
            args: { text: 'Fast note', x: 140, y: 140, color: '#ffeb3b' },
          },
        ]) as never,
      );
      mockExecute.mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'createStickyNote', args: {}, result: 'Affected: fast-note-1' }],
        objectsAffected: ['fast-note-1'],
        toolOutputs: [],
      });

      const startedAt = performance.now();
      const response = await POST(makeRequest('Add a yellow sticky note that says "Fast note"'));
      const elapsedMs = performance.now() - startedAt;
      const body = await response.json() as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(elapsedMs).toBeLessThan(2000);
    });
  });
});
