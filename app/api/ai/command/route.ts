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
import { planComplexCommand, verifyPlanExecution } from '@/lib/ai-agent/planner';
import type { ToolCallInput } from '@/lib/ai-agent/executor';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { BoardStateScopeContext, BoardStateViewport, ScopedBoardState } from '@/lib/ai-agent/scoped-state';
import type { CommandTraceContext } from '@/lib/ai-agent/tracing';
import type { ExecutionTraceEvent, ExecutionTraceOptions } from '@/lib/ai-agent/executor';

const SYSTEM_PROMPT = `You are an AI assistant that controls a collaborative whiteboard called CollabBoard.

You can ONLY manipulate the whiteboard by calling the provided tools. You must not answer general questions, write code, or do anything unrelated to board manipulation.

Rules:
- Use findObjects() first for precise targeting when the user references subsets (color/text/frame/region like "pink notes", "notes in sprint frame").
- Use getBoardState() first when you need broader board context before deciding an action.
- Use canvas coordinates: x increases rightward, y increases downward.
- Reasonable default positions are between 100–800 x and 100–600 y.
- Default sticky note size: 200x200. Default shape sizes: 200x150.
- Default sticky note color: #ffeb3b (yellow). Use named colors when the user specifies (e.g. red = #f87171, blue = #60a5fa, green = #a3e635, purple = #c084fc, orange = #fb923c).
- If the user's command is not about the board, respond by calling no tools.`;

interface AICommandRequest {
  boardId: string;
  command: string;
  context?: BoardStateScopeContext;
}

interface AICommandResponse {
  success: boolean;
  actions: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  objectsAffected: string[];
  error?: string;
}

const READ_ONLY_TOOLS = new Set(['getBoardState', 'findObjects']);
const MUTATION_TOOLS = new Set([
  'createStickyNote',
  'createShape',
  'createFrame',
  'createConnector',
  'moveObject',
  'resizeObject',
  'updateText',
  'changeColor',
]);

function hasReadOnlyToolCall(toolCalls: ToolCallInput[]): boolean {
  return toolCalls.some((toolCall) => READ_ONLY_TOOLS.has(toolCall.function.name));
}

function hasMutationToolCall(toolCalls: ToolCallInput[]): boolean {
  return toolCalls.some((toolCall) => MUTATION_TOOLS.has(toolCall.function.name));
}

function isLikelyEditIntent(command: string): boolean {
  const normalized = command.toLowerCase();
  return /\b(move|resize|rename|recolor|change|update|align|arrange|distribute|reposition|shift)\b/.test(normalized);
}

function isRetryableObjectResolutionError(error: string | undefined): boolean {
  if (!error) return false;
  return /\b(not\s+found|stale|missing|does\s+not\s+exist)\b/i.test(error);
}

function getReturnedCountFromOutput(output: unknown): number | null {
  if (!isRecord(output)) return null;
  const returnedCount = output.returnedCount;
  return typeof returnedCount === 'number' ? returnedCount : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toViewport(value: unknown): BoardStateViewport | undefined {
  if (!isRecord(value)) return undefined;
  const x = value.x;
  const y = value.y;
  const width = value.width;
  const height = value.height;
  if (
    typeof x !== 'number'
    || typeof y !== 'number'
    || typeof width !== 'number'
    || typeof height !== 'number'
    || width <= 0
    || height <= 0
  ) {
    return undefined;
  }
  return { x, y, width, height };
}

function sanitizeCommandContext(value: unknown): BoardStateScopeContext | undefined {
  if (!isRecord(value)) return undefined;
  const context: BoardStateScopeContext = {};

  if (typeof value.type === 'string' && value.type.trim().length > 0) {
    context.type = value.type.trim();
  }
  if (typeof value.color === 'string' && value.color.trim().length > 0) {
    context.color = value.color.trim();
  }
  if (typeof value.textContains === 'string' && value.textContains.trim().length > 0) {
    context.textContains = value.textContains.trim();
  }
  if (Array.isArray(value.selectedObjectIds)) {
    const selectedObjectIds = value.selectedObjectIds
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (selectedObjectIds.length > 0) {
      context.selectedObjectIds = selectedObjectIds;
    }
  }
  const viewport = toViewport(value.viewport);
  if (viewport) {
    context.viewport = viewport;
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

function buildBoardStateArgs(command: string, context?: BoardStateScopeContext): Record<string, unknown> {
  return {
    command,
    ...(context ?? {}),
  };
}

function mergeReadContextIntoCalls(
  toolCalls: ToolCallInput[],
  command: string,
  context?: BoardStateScopeContext,
): ToolCallInput[] {
  return toolCalls.map((toolCall) => {
    if (toolCall.function.name !== 'getBoardState' && toolCall.function.name !== 'findObjects') {
      return toolCall;
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
    } catch {
      parsedArgs = {};
    }

    const mergedArgs: Record<string, unknown> = {
      ...buildBoardStateArgs(command, context),
      ...parsedArgs,
    };

    return {
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: JSON.stringify(mergedArgs),
      },
    };
  });
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

function toPlannedToolCalls(steps: Array<{ tool: string; args: Record<string, unknown> }>, idPrefix: string): ToolCallInput[] {
  return steps.map((step, index) => ({
    id: `${idPrefix}-${index + 1}`,
    type: 'function',
    function: {
      name: step.tool,
      arguments: JSON.stringify(step.args),
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
  const accuracyTelemetry = {
    resolutionSource: 'none',
    candidateCount: 0,
    retryCount: 0,
    verificationCorrections: 0,
  };

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
          resolutionSource: accuracyTelemetry.resolutionSource,
          candidateCount: accuracyTelemetry.candidateCount,
          retryCount: accuracyTelemetry.retryCount,
          verificationCorrections: accuracyTelemetry.verificationCorrections,
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
    const commandContext = sanitizeCommandContext(body.context);

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
      accuracyTelemetry.resolutionSource = 'deterministic-planner';
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
              function: {
                name: 'getBoardState',
                arguments: JSON.stringify(buildBoardStateArgs(trimmedCommand, commandContext)),
              },
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
        accuracyTelemetry.candidateCount = Math.max(
          accuracyTelemetry.candidateCount,
          getReturnedCountFromOutput(boardStateRead.toolOutputs.at(-1)?.output) ?? 0,
        );

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

      const plannedToolCalls = toPlannedToolCalls(resolvedPlan.steps, 'planned-step');

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
          const topUpToolCalls = toPlannedToolCalls(remainingSteps, `planned-topup-step-${createdSoFar}`);

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

      if (planExecution.success && resolvedPlan.verification) {
        const verificationStateRead = await executeToolCalls(
          [
            {
              id: 'planned-verification-state',
              type: 'function',
              function: {
                name: 'getBoardState',
                arguments: JSON.stringify(buildBoardStateArgs(trimmedCommand, commandContext)),
              },
            },
          ],
          trimmedBoardId,
          user.id,
          getExecutionTraceOptions(),
        );

        if (verificationStateRead.success) {
          const latestState = verificationStateRead.toolOutputs.at(-1)?.output as ScopedBoardState | undefined;
          if (latestState) {
            const verificationResult = verifyPlanExecution(resolvedPlan, latestState);
            void recordCommandTraceEvent(traceContext, 'planner-verification-check', {
              passed: verificationResult.passed,
              issueCount: verificationResult.issues.length,
              correctiveStepCount: verificationResult.correctiveSteps.length,
            });

            if (!verificationResult.passed && verificationResult.correctiveSteps.length > 0) {
              const correctiveToolCalls = toPlannedToolCalls(
                verificationResult.correctiveSteps,
                'planned-correction-step',
              );
              const correctionExecution = await executeToolCalls(
                correctiveToolCalls,
                trimmedBoardId,
                user.id,
                getExecutionTraceOptions(),
              );

              planExecution = {
                success: planExecution.success && correctionExecution.success,
                actions: [...planExecution.actions, ...correctionExecution.actions],
                objectsAffected: [...planExecution.objectsAffected, ...correctionExecution.objectsAffected],
                toolOutputs: [...planExecution.toolOutputs, ...correctionExecution.toolOutputs],
                ...(correctionExecution.error ? { error: correctionExecution.error } : {}),
              };
              void recordCommandTraceEvent(traceContext, 'planner-verification-correction', {
                requestedCorrections: correctiveToolCalls.length,
                correctionSuccess: correctionExecution.success,
              });
              accuracyTelemetry.verificationCorrections += correctiveToolCalls.length;
            }
          }
        } else {
          void recordCommandTraceEvent(traceContext, 'planner-verification-skipped', {
            reason: 'state-read-failed',
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

    const firstToolCallsWithContext = mergeReadContextIntoCalls(
      firstToolCalls,
      trimmedCommand,
      commandContext,
    );

    const buildForcedReadCall = (id: string): ToolCallInput => ({
      id,
      type: 'function',
      function: {
        name: 'getBoardState',
        arguments: JSON.stringify(buildBoardStateArgs(trimmedCommand, commandContext)),
      },
    });

    const executeStaleIdRetry = async (
      priorActions: Array<{ tool: string; args: Record<string, unknown>; result: string }>,
      priorObjectsAffected: string[],
      initialError?: string,
    ): Promise<AICommandResponse | null> => {
      if (!isRetryableObjectResolutionError(initialError)) {
        return null;
      }

      accuracyTelemetry.retryCount += 1;
      accuracyTelemetry.resolutionSource = 'retry-read-pass';
      void recordCommandTraceEvent(traceContext!, 'route-stale-id-retry', {
        reason: initialError,
      });

      const retryStateRead = await executeToolCalls(
        [buildForcedReadCall('retry-read-state')],
        trimmedBoardId,
        user.id,
        getExecutionTraceOptions(),
      );

      if (!retryStateRead.success) {
        return {
          success: false,
          actions: [...priorActions, ...retryStateRead.actions],
          objectsAffected: [...priorObjectsAffected, ...retryStateRead.objectsAffected],
          error: retryStateRead.error ?? initialError ?? 'Retry state read failed',
        };
      }

      accuracyTelemetry.candidateCount = Math.max(
        accuracyTelemetry.candidateCount,
        getReturnedCountFromOutput(retryStateRead.toolOutputs.at(-1)?.output) ?? 0,
      );

      const retryState = retryStateRead.toolOutputs.at(-1)?.output;
      const retryMessages: ChatCompletionMessageParam[] = [
        ...baseMessages,
        {
          role: 'system',
          content:
            'The previous mutation failed because object IDs were stale or missing. Re-resolve targets and execute the board change using concrete IDs from this scoped state: '
            + JSON.stringify(retryState),
        },
      ];

      const retryCompletion = await createTracedCompletion(
        openai,
        {
          model: 'gpt-4o-mini',
          messages: retryMessages,
          tools: AI_TOOLS,
          tool_choice: 'auto',
        },
        {
          traceName: 'ai-board-command-retry',
          context: traceContext!,
          metadata: { routePhase: 'stale-id-retry' },
        },
      );

      const retryResponseMessage = retryCompletion.choices[0]?.message;
      const retryToolCalls = toToolCallInputs(
        (retryResponseMessage?.tool_calls as Array<{ id: string; type: string; function?: { name: string; arguments: string } }> | undefined),
      );

      if (retryToolCalls.length === 0) {
        void recordCommandTraceEvent(traceContext!, 'route-stale-id-retry-result', {
          success: false,
          reason: 'no-tool-calls',
        });
        return {
          success: false,
          actions: [...priorActions, ...retryStateRead.actions],
          objectsAffected: [...priorObjectsAffected, ...retryStateRead.objectsAffected],
          error: initialError ?? 'Retry produced no tool calls',
        };
      }

      const retryToolCallsWithContext = mergeReadContextIntoCalls(
        retryToolCalls,
        trimmedCommand,
        commandContext,
      );

      const retryExecution = await executeToolCalls(
        retryToolCallsWithContext,
        trimmedBoardId,
        user.id,
        getExecutionTraceOptions(),
      );

      void recordCommandTraceEvent(traceContext!, 'route-stale-id-retry-result', {
        success: retryExecution.success,
        toolCallCount: retryToolCallsWithContext.length,
      });

      return {
        success: retryExecution.success,
        actions: [...priorActions, ...retryStateRead.actions, ...retryExecution.actions],
        objectsAffected: [...priorObjectsAffected, ...retryStateRead.objectsAffected, ...retryExecution.objectsAffected],
        ...(retryExecution.error ? { error: retryExecution.error } : {}),
      };
    };

    const runFollowupPass = async (
      readPassExecution: Awaited<ReturnType<typeof executeToolCalls>>,
    ): Promise<AICommandResponse> => {
      const latestReadOutput = readPassExecution.toolOutputs.at(-1);
      const latestBoardState = latestReadOutput?.output;
      if (latestReadOutput?.tool === 'getBoardState' || latestReadOutput?.tool === 'findObjects') {
        accuracyTelemetry.resolutionSource = latestReadOutput.tool;
      }
      accuracyTelemetry.candidateCount = Math.max(
        accuracyTelemetry.candidateCount,
        getReturnedCountFromOutput(latestBoardState) ?? 0,
      );
      setCommandTraceExecutionPath(traceContext!, 'llm-followup');
      void recordCommandTraceEvent(traceContext!, 'route-followup-triggered', {
        toolOutputs: readPassExecution.toolOutputs.length,
      });
      const followupMessages: ChatCompletionMessageParam[] = [
        ...baseMessages,
        {
          role: 'system',
          content:
            'You previously used read-only board tools. Now execute the requested board change by calling mutation tools with concrete object IDs from this scoped state: '
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
          context: traceContext!,
          metadata: { routePhase: 'followup' },
        },
      );

      const secondResponseMessage = secondCompletion.choices[0]?.message;
      const secondToolCalls = toToolCallInputs(
        (secondResponseMessage?.tool_calls as Array<{ id: string; type: string; function?: { name: string; arguments: string } }> | undefined),
      );

      if (secondToolCalls.length === 0) {
        void recordCommandTraceEvent(traceContext!, 'route-no-tool-calls', {
          stage: 'followup-pass',
        });
        return {
          success: readPassExecution.success,
          actions: readPassExecution.actions,
          objectsAffected: readPassExecution.objectsAffected,
        };
      }

      const secondToolCallsWithContext = mergeReadContextIntoCalls(
        secondToolCalls,
        trimmedCommand,
        commandContext,
      );
      const secondExecution = await executeToolCalls(
        secondToolCallsWithContext,
        trimmedBoardId,
        user.id,
        getExecutionTraceOptions(),
      );

      if (!secondExecution.success) {
        const retryPayload = await executeStaleIdRetry(
          [...readPassExecution.actions, ...secondExecution.actions],
          [...readPassExecution.objectsAffected, ...secondExecution.objectsAffected],
          secondExecution.error,
        );
        if (retryPayload) {
          return retryPayload;
        }
      }

      const combinedSuccess = readPassExecution.success && secondExecution.success;
      return {
        success: combinedSuccess,
        actions: [...readPassExecution.actions, ...secondExecution.actions],
        objectsAffected: [...readPassExecution.objectsAffected, ...secondExecution.objectsAffected],
        ...(secondExecution.error ? { error: secondExecution.error } : {}),
      };
    };

    const shouldForceReadBeforeMutate =
      isLikelyEditIntent(trimmedCommand)
      && hasMutationToolCall(firstToolCallsWithContext)
      && !hasReadOnlyToolCall(firstToolCallsWithContext);

    if (shouldForceReadBeforeMutate) {
      accuracyTelemetry.resolutionSource = 'forced-read-pass';
      void recordCommandTraceEvent(traceContext, 'route-read-before-mutate-enforced', {
        firstToolNames: firstToolCallsWithContext.map((call) => call.function.name),
      });
      const forcedReadExecution = await executeToolCalls(
        [buildForcedReadCall('forced-read-before-mutate')],
        trimmedBoardId,
        user.id,
        getExecutionTraceOptions(),
      );
      if (!forcedReadExecution.success) {
        return respond({
          success: false,
          actions: forcedReadExecution.actions,
          objectsAffected: forcedReadExecution.objectsAffected,
          ...(forcedReadExecution.error ? { error: forcedReadExecution.error } : {}),
        });
      }
      return respond(await runFollowupPass(forcedReadExecution));
    }

    const executionResult = await executeToolCalls(
      firstToolCallsWithContext,
      trimmedBoardId,
      user.id,
      getExecutionTraceOptions(),
    );
    if (!hasReadOnlyToolCall(firstToolCallsWithContext)) {
      accuracyTelemetry.resolutionSource = 'direct-mutation';
    }

    const hadOnlyReadStatePass =
      executionResult.success &&
      executionResult.objectsAffected.length === 0 &&
      executionResult.toolOutputs.length > 0 &&
      executionResult.toolOutputs.every((output) => output.tool === 'getBoardState' || output.tool === 'findObjects');

    if (hadOnlyReadStatePass) {
      return respond(await runFollowupPass(executionResult));
    }

    if (!executionResult.success) {
      const retryPayload = await executeStaleIdRetry(
        executionResult.actions,
        executionResult.objectsAffected,
        executionResult.error,
      );
      if (retryPayload) {
        return respond(retryPayload);
      }
    }

    return respond({
      success: executionResult.success,
      actions: executionResult.actions,
      objectsAffected: executionResult.objectsAffected,
      ...(executionResult.error ? { error: executionResult.error } : {}),
      ...(executionResult.inlineCreatedObjects?.length ? { inlineCreatedObjects: executionResult.inlineCreatedObjects } : {}),
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
