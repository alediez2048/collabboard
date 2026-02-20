import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { AI_TOOLS } from '@/lib/ai-agent/tools';
import { executeToolCalls } from '@/lib/ai-agent/executor';
import {
  createTracedCompletion,
  finishCommandTrace,
  recordCommandTraceEvent,
  setCommandTraceExecutionPath,
  startCommandTrace,
} from '@/lib/ai-agent/tracing';
import { planComplexCommand } from '@/lib/ai-agent/planner';
import type { ToolCallInput } from '@/lib/ai-agent/executor';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ScopedBoardState } from '@/lib/ai-agent/scoped-state';
import type { CommandTraceContext } from '@/lib/ai-agent/tracing';
import type { ExecutionTraceEvent, ExecutionTraceOptions } from '@/lib/ai-agent/executor';

const SYSTEM_PROMPT = `You are an AI assistant that controls a collaborative whiteboard called CollabBoard.

You can ONLY manipulate the whiteboard by calling the provided tools. You must not answer general questions, write code, or do anything unrelated to board manipulation.

Rules:
- Always use getBoardState() first if the user's command references existing objects (e.g. "move the notes", "change the color").
- Use canvas coordinates: x increases rightward, y increases downward.
- Reasonable default positions are between 100–800 x and 100–600 y.
- Default sticky note size: 200x200. Default shape sizes: 200x150.
- Default sticky note color: #ffeb3b (yellow). Use named colors when the user specifies (e.g. red = #f87171, blue = #60a5fa, green = #a3e635, purple = #c084fc, orange = #fb923c).
- If the user's command is not about the board, respond by calling no tools.`;

interface AICommandRequest {
  boardId: string;
  command: string;
}

interface AICommandResponse {
  success: boolean;
  actions: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  objectsAffected: string[];
  error?: string;
}

function toToolCallInputs(
  toolCalls: Array<{ id: string; type: string; function?: { name: string; arguments: string } }> | undefined,
): ToolCallInput[] {
  if (!toolCalls || toolCalls.length === 0) {
    return [];
  }

  return toolCalls
    .filter((tc): tc is { id: string; type: 'function'; function: { name: string; arguments: string } } =>
      tc.type === 'function' && typeof tc.function?.name === 'string' && typeof tc.function?.arguments === 'string',
    )
    .map((tc) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));
}

/**
 * POST /api/ai/command
 * Accepts { boardId, command }, calls OpenAI with function calling,
 * executes tool calls sequentially via the realtime server bridge,
 * and returns a structured response.
 */
export async function POST(request: NextRequest): Promise<NextResponse<AICommandResponse>> {
  let traceContext: CommandTraceContext | null = null;

  const emitTraceEvent = (event: ExecutionTraceEvent): void => {
    if (!traceContext) return;
    void recordCommandTraceEvent(traceContext, event.name, event.metadata);
  };

  const getExecutionTraceOptions = (): ExecutionTraceOptions | undefined => {
    if (!traceContext) return undefined;
    return {
      traceId: traceContext.traceId,
      onEvent: emitTraceEvent,
    };
  };

  const respond = (
    payload: AICommandResponse,
    init?: { status: number },
  ): NextResponse<AICommandResponse> => {
    if (traceContext) {
      void finishCommandTrace(traceContext, {
        success: payload.success,
        ...(payload.error ? { error: payload.error } : {}),
        metadata: {
          statusCode: init?.status ?? 200,
          actionsCount: payload.actions.length,
          objectsAffectedCount: payload.objectsAffected.length,
        },
      });
    }

    return NextResponse.json(payload, init);
  };

  try {
    // Auth check — mirror pattern from /api/boards/[id]/join
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, actions: [], objectsAffected: [], error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Parse and validate payload
    let body: Partial<AICommandRequest>;
    try {
      body = await request.json() as Partial<AICommandRequest>;
    } catch {
      return NextResponse.json(
        { success: false, actions: [], objectsAffected: [], error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const { boardId, command } = body;

    if (!boardId || typeof boardId !== 'string' || boardId.trim().length === 0) {
      return NextResponse.json(
        { success: false, actions: [], objectsAffected: [], error: 'boardId is required' },
        { status: 400 },
      );
    }

    if (!command || typeof command !== 'string' || command.trim().length === 0) {
      return NextResponse.json(
        { success: false, actions: [], objectsAffected: [], error: 'command is required and must not be empty' },
        { status: 400 },
      );
    }

    const trimmedBoardId = boardId.trim();
    const trimmedCommand = command.trim();

    traceContext = startCommandTrace({
      traceName: 'ai-board-command',
      boardId: trimmedBoardId,
      userId: user.id,
      command: trimmedCommand,
    });
    void recordCommandTraceEvent(traceContext, 'route-start', {
      boardId: trimmedBoardId,
      userId: user.id,
      commandLength: trimmedCommand.length,
    });

    // Deterministic planner path for complex/template commands.
    // This keeps execution sequential and predictable for multi-step setup/layout requests.
    const initialPlan = planComplexCommand(trimmedCommand);
    if (initialPlan) {
      setCommandTraceExecutionPath(traceContext, 'deterministic-planner');
      void recordCommandTraceEvent(traceContext, 'route-decision', {
        path: 'deterministic-planner',
        requiresBoardState: initialPlan.requiresBoardState,
        plannedStepCount: initialPlan.steps.length,
      });

      let plannedActions: Array<{ tool: string; args: Record<string, unknown>; result: string }> = [];
      let plannedObjectsAffected: string[] = [];
      let resolvedPlan = initialPlan;

      if (initialPlan.requiresBoardState) {
        const boardStateRead = await executeToolCalls(
          [
            {
              id: 'planned-get-board-state',
              type: 'function',
              function: { name: 'getBoardState', arguments: '{}' },
            },
          ],
          trimmedBoardId,
          user.id,
          getExecutionTraceOptions(),
        );

        if (!boardStateRead.success) {
          return respond({
            success: false,
            actions: boardStateRead.actions,
            objectsAffected: boardStateRead.objectsAffected,
            ...(boardStateRead.error ? { error: boardStateRead.error } : {}),
          });
        }

        plannedActions = [...boardStateRead.actions];
        plannedObjectsAffected = [...boardStateRead.objectsAffected];

        const latestState = boardStateRead.toolOutputs.at(-1)?.output as ScopedBoardState | undefined;
        resolvedPlan = planComplexCommand(trimmedCommand, latestState) ?? { requiresBoardState: false, steps: [] };
        void recordCommandTraceEvent(traceContext, 'planner-board-state-resolved', {
          totalObjects: latestState?.totalObjects ?? 0,
          returnedCount: latestState?.returnedCount ?? 0,
          resolvedStepCount: resolvedPlan.steps.length,
        });
      }

      if (resolvedPlan.steps.length === 0) {
        return respond({
          success: true,
          actions: plannedActions,
          objectsAffected: plannedObjectsAffected,
        });
      }

      const plannedToolCalls: ToolCallInput[] = resolvedPlan.steps.map((step, index) => ({
        id: `planned-step-${index + 1}`,
        type: 'function',
        function: {
          name: step.tool,
          arguments: JSON.stringify(step.args),
        },
      }));

      let planExecution = await executeToolCalls(plannedToolCalls, trimmedBoardId, user.id, getExecutionTraceOptions());

      // Consistency guard: deterministic bulk sticky plans should produce the
      // exact requested count. If the bridge returns fewer successful creates,
      // run one top-up pass for the remaining planned steps.
      const isDeterministicBulkStickyPlan =
        resolvedPlan.steps.length > 0 &&
        resolvedPlan.steps.every((step) => step.tool === 'createStickyNote');

      if (planExecution.success && isDeterministicBulkStickyPlan) {
        const expectedCreates = resolvedPlan.steps.length;
        const createdSoFar = planExecution.actions.filter((action) => action.tool === 'createStickyNote').length;
        void recordCommandTraceEvent(traceContext, 'planner-bulk-consistency-check', {
          expectedCreates,
          createdSoFar,
        });

        if (createdSoFar < expectedCreates) {
          const remainingSteps = resolvedPlan.steps.slice(createdSoFar);
          const topUpToolCalls: ToolCallInput[] = remainingSteps.map((step, index) => ({
            id: `planned-topup-step-${createdSoFar + index + 1}`,
            type: 'function',
            function: {
              name: step.tool,
              arguments: JSON.stringify(step.args),
            },
          }));

          const topUpExecution = await executeToolCalls(
            topUpToolCalls,
            trimmedBoardId,
            user.id,
            getExecutionTraceOptions(),
          );
          planExecution = {
            success: planExecution.success && topUpExecution.success,
            actions: [...planExecution.actions, ...topUpExecution.actions],
            objectsAffected: [...planExecution.objectsAffected, ...topUpExecution.objectsAffected],
            toolOutputs: [...planExecution.toolOutputs, ...topUpExecution.toolOutputs],
            ...(topUpExecution.error ? { error: topUpExecution.error } : {}),
          };
          void recordCommandTraceEvent(traceContext, 'planner-bulk-topup', {
            requestedTopUpCount: topUpToolCalls.length,
            topUpSuccess: topUpExecution.success,
          });
        }
      }

      return respond({
        success: planExecution.success,
        actions: [...plannedActions, ...planExecution.actions],
        objectsAffected: [...plannedObjectsAffected, ...planExecution.objectsAffected],
        ...(planExecution.error ? { error: planExecution.error } : {}),
      });
    }

    // Call OpenAI with tool-calling (traced via tracing adapter from 1.3 reference pattern)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    setCommandTraceExecutionPath(traceContext, 'llm-single-step');
    void recordCommandTraceEvent(traceContext, 'route-decision', {
      path: 'llm-single-step',
    });

    const baseMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: trimmedCommand },
    ];

    const completion = await createTracedCompletion(
      openai,
      {
        model: 'gpt-4o-mini',
        messages: baseMessages,
        tools: AI_TOOLS,
        tool_choice: 'auto',
      },
      {
        traceName: 'ai-board-command',
        context: traceContext,
        metadata: { routePhase: 'single-step' },
      },
    );

    const responseMessage = completion.choices[0]?.message;
    const firstToolCalls = toToolCallInputs(
      (responseMessage?.tool_calls as Array<{ id: string; type: string; function?: { name: string; arguments: string } }> | undefined),
    );

    // No tool calls — model declined to act (command not board-related)
    if (firstToolCalls.length === 0) {
      void recordCommandTraceEvent(traceContext, 'route-no-tool-calls', {
        stage: 'first-pass',
      });
      return respond({
        success: true,
        actions: [],
        objectsAffected: [],
      });
    }

    const executionResult = await executeToolCalls(
      firstToolCalls,
      trimmedBoardId,
      user.id,
      getExecutionTraceOptions(),
    );

    // If the first pass only retrieved board state, run one follow-up completion
    // with scoped board context so the model can emit mutation tool calls.
    const hadOnlyReadStatePass =
      executionResult.success &&
      executionResult.objectsAffected.length === 0 &&
      executionResult.toolOutputs.length > 0 &&
      executionResult.toolOutputs.every((output) => output.tool === 'getBoardState');

    if (!hadOnlyReadStatePass) {
      return respond({
        success: executionResult.success,
        actions: executionResult.actions,
        objectsAffected: executionResult.objectsAffected,
        ...(executionResult.error ? { error: executionResult.error } : {}),
      });
    }

    const latestBoardState = executionResult.toolOutputs.at(-1)?.output;
    setCommandTraceExecutionPath(traceContext, 'llm-followup');
    void recordCommandTraceEvent(traceContext, 'route-followup-triggered', {
      toolOutputs: executionResult.toolOutputs.length,
    });
    const followupMessages: ChatCompletionMessageParam[] = [
      ...baseMessages,
      {
        role: 'system',
        content:
          'You previously used getBoardState. Now execute the requested board change by calling mutation tools with concrete object IDs from this scoped state: '
          + JSON.stringify(latestBoardState),
      },
    ];

    const secondCompletion = await createTracedCompletion(
      openai,
      {
        model: 'gpt-4o-mini',
        messages: followupMessages,
        tools: AI_TOOLS,
        tool_choice: 'auto',
      },
      {
        traceName: 'ai-board-command-followup',
        context: traceContext,
        metadata: { routePhase: 'followup' },
      },
    );

    const secondResponseMessage = secondCompletion.choices[0]?.message;
    const secondToolCalls = toToolCallInputs(
      (secondResponseMessage?.tool_calls as Array<{ id: string; type: string; function?: { name: string; arguments: string } }> | undefined),
    );

    if (secondToolCalls.length === 0) {
      void recordCommandTraceEvent(traceContext, 'route-no-tool-calls', {
        stage: 'followup-pass',
      });
      return respond({
        success: executionResult.success,
        actions: executionResult.actions,
        objectsAffected: executionResult.objectsAffected,
      });
    }

    const secondExecution = await executeToolCalls(
      secondToolCalls,
      trimmedBoardId,
      user.id,
      getExecutionTraceOptions(),
    );
    const combinedSuccess = executionResult.success && secondExecution.success;
    const combinedActions = [...executionResult.actions, ...secondExecution.actions];
    const combinedObjectsAffected = [...executionResult.objectsAffected, ...secondExecution.objectsAffected];

    return respond({
      success: combinedSuccess,
      actions: combinedActions,
      objectsAffected: combinedObjectsAffected,
      ...(secondExecution.error ? { error: secondExecution.error } : {}),
    });
  } catch (err) {
    console.error('[AI Command] Unexpected error:', err);
    if (traceContext) {
      void finishCommandTrace(traceContext, {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
        metadata: { statusCode: 500, unexpected: true },
      });
    }
    return NextResponse.json(
      { success: false, actions: [], objectsAffected: [], error: 'Internal server error' },
      { status: 500 },
    );
  }
}
