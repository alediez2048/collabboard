import {
  validateCreateStickyNoteArgs,
  validateCreateShapeArgs,
  validateCreateFrameArgs,
  validateCreateConnectorArgs,
  validateMoveObjectArgs,
  validateUpdateTextArgs,
  validateChangeColorArgs,
  validateResizeObjectArgs,
  validateFindObjectsArgs,
} from '@/lib/ai-agent/tools';
import type { BoardStateScopeContext, BoardStateViewport, ScopedBoardState } from '@/lib/ai-agent/scoped-state';
import {
  inlineMutate,
  inlineMutateBatch,
  inlineBoardState,
  inlineFindObjects,
} from '@/lib/ai-agent/inline-bridge';

function isConnectionError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'fetch failed') return true;
  if (err instanceof Error && /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/.test(err.message)) return true;
  return false;
}

export interface ToolCallInput {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ActionRecord {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

export interface ToolOutputRecord {
  toolCallId: string;
  tool: string;
  output: unknown;
}

export interface ExecutionResult {
  success: boolean;
  actions: ActionRecord[];
  objectsAffected: string[];
  toolOutputs: ToolOutputRecord[];
  inlineCreatedObjects?: Array<Record<string, unknown>>;
  error?: string;
}

export interface ExecutionTraceEvent {
  name: string;
  metadata: Record<string, unknown>;
}

export interface ExecutionTraceOptions {
  traceId?: string;
  onEvent?: (event: ExecutionTraceEvent) => void;
}

interface BridgeMutateResponse {
  success: boolean;
  affectedObjectIds: string[];
  objects?: Array<Record<string, unknown>>;
  error?: string;
}

interface BridgeBatchResult {
  affectedObjectIds: string[];
  error?: string;
}

interface BridgeBatchMutateResponse {
  success: boolean;
  results?: BridgeBatchResult[];
  objects?: Array<Record<string, unknown>>;
  failedIndex?: number;
  error?: string;
}

interface BridgeStateResponse extends ScopedBoardState {
  error?: string;
}

interface BridgeFindObjectsResponse extends ScopedBoardState {
  objectIds: string[];
  error?: string;
}

interface FindObjectsQuery extends BoardStateScopeContext {
  inFrameId?: string;
  nearX?: number;
  nearY?: number;
  maxResults?: number;
}

function getRealtimeServerUrl(): string {
  return process.env.REALTIME_SERVER_URL ?? 'http://localhost:4000';
}

function getBridgeSecret(): string {
  return process.env.AI_BRIDGE_SECRET ?? '';
}

function buildBridgeHeaders(traceId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getBridgeSecret()}`,
  };

  if (traceId && traceId.trim().length > 0) {
    headers['X-AI-Trace-Id'] = traceId;
  }

  return headers;
}

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

const BULK_MUTATION_BATCH_THRESHOLD = 10;

function validateArgs(
  toolName: string,
  args: Record<string, unknown>,
): { valid: boolean; error?: string } {
  switch (toolName) {
    case 'createStickyNote': return validateCreateStickyNoteArgs(args);
    case 'createShape': return validateCreateShapeArgs(args);
    case 'createFrame': return validateCreateFrameArgs(args);
    case 'createConnector': return validateCreateConnectorArgs(args);
    case 'moveObject': return validateMoveObjectArgs(args);
    case 'resizeObject': return validateResizeObjectArgs(args);
    case 'updateText': return validateUpdateTextArgs(args);
    case 'changeColor': return validateChangeColorArgs(args);
    case 'getBoardState': return { valid: true };
    case 'findObjects': return validateFindObjectsArgs(args);
    default: return { valid: false, error: `Unknown tool: ${toolName}` };
  }
}

async function callBridgeMutate(
  boardId: string,
  userId: string,
  tool: string,
  args: Record<string, unknown>,
  traceId?: string,
): Promise<BridgeMutateResponse> {
  const url = `${getRealtimeServerUrl()}/ai/mutate`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildBridgeHeaders(traceId),
      body: JSON.stringify({ boardId, userId, action: { tool, args } }),
    });
    return res.json() as Promise<BridgeMutateResponse>;
  } catch (fetchErr) {
    if (isConnectionError(fetchErr)) {
      return inlineMutate(boardId, userId, { tool, args });
    }
    throw fetchErr;
  }
}

async function callBridgeMutateBatch(
  boardId: string,
  userId: string,
  actions: Array<{ tool: string; args: Record<string, unknown> }>,
  traceId?: string,
): Promise<BridgeBatchMutateResponse> {
  const url = `${getRealtimeServerUrl()}/ai/mutate-batch`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildBridgeHeaders(traceId),
      body: JSON.stringify({ boardId, userId, actions }),
    });
    return res.json() as Promise<BridgeBatchMutateResponse>;
  } catch (fetchErr) {
    if (isConnectionError(fetchErr)) {
      return inlineMutateBatch(boardId, userId, actions);
    }
    throw fetchErr;
  }
}

async function callBridgeBoardState(
  boardId: string,
  context: BoardStateScopeContext | undefined,
  traceId?: string,
): Promise<BridgeStateResponse> {
  const url = `${getRealtimeServerUrl()}/ai/board-state`;
  const payload: { boardId: string; context?: BoardStateScopeContext } = { boardId };
  if (context) {
    payload.context = context;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildBridgeHeaders(traceId),
      body: JSON.stringify(payload),
    });
    return res.json() as Promise<BridgeStateResponse>;
  } catch (fetchErr) {
    if (isConnectionError(fetchErr)) {
      return inlineBoardState(boardId, context);
    }
    throw fetchErr;
  }
}

async function callBridgeFindObjects(
  boardId: string,
  query: FindObjectsQuery,
  traceId?: string,
): Promise<BridgeFindObjectsResponse> {
  const url = `${getRealtimeServerUrl()}/ai/find-objects`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildBridgeHeaders(traceId),
      body: JSON.stringify({ boardId, query }),
    });
    return res.json() as Promise<BridgeFindObjectsResponse>;
  } catch (fetchErr) {
    if (isConnectionError(fetchErr)) {
      return inlineFindObjects(boardId, query);
    }
    throw fetchErr;
  }
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

function toBoardStateScopeContext(args: Record<string, unknown>): BoardStateScopeContext | undefined {
  const context: BoardStateScopeContext = {};

  if (typeof args.command === 'string' && args.command.trim().length > 0) {
    context.command = args.command.trim();
  }

  if (typeof args.type === 'string' && args.type.trim().length > 0) {
    context.type = args.type.trim();
  }

  if (typeof args.color === 'string' && args.color.trim().length > 0) {
    context.color = args.color.trim();
  }

  if (typeof args.textContains === 'string' && args.textContains.trim().length > 0) {
    context.textContains = args.textContains.trim();
  }

  if (Array.isArray(args.selectedObjectIds)) {
    const selectedObjectIds = args.selectedObjectIds
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (selectedObjectIds.length > 0) {
      context.selectedObjectIds = selectedObjectIds;
    }
  }

  const viewport = toViewport(args.viewport);
  if (viewport) {
    context.viewport = viewport;
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

function toFindObjectsQuery(args: Record<string, unknown>): FindObjectsQuery {
  const query: FindObjectsQuery = { ...(toBoardStateScopeContext(args) ?? {}) };

  if (typeof args.inFrameId === 'string' && args.inFrameId.trim().length > 0) {
    query.inFrameId = args.inFrameId.trim();
  }

  if (typeof args.nearX === 'number' && typeof args.nearY === 'number') {
    query.nearX = args.nearX;
    query.nearY = args.nearY;
  }

  if (typeof args.maxResults === 'number') {
    query.maxResults = args.maxResults;
  }

  return query;
}

function emitTraceEvent(
  traceOptions: ExecutionTraceOptions | undefined,
  name: string,
  metadata: Record<string, unknown>,
): void {
  traceOptions?.onEvent?.({ name, metadata });
}

/**
 * Execute a list of tool calls sequentially.
 * Validates args before calling the bridge.
 * Stops on first failure.
 * Returns structured result with all affected object IDs.
 */
export async function executeToolCalls(
  toolCalls: ToolCallInput[],
  boardId: string,
  userId: string,
  traceOptions?: ExecutionTraceOptions,
): Promise<ExecutionResult> {
  const actions: ActionRecord[] = [];
  const objectsAffected: string[] = [];
  const toolOutputs: ToolOutputRecord[] = [];
  const inlineCreatedObjects: Array<Record<string, unknown>> = [];

  for (let index = 0; index < toolCalls.length; index += 1) {
    const call = toolCalls[index];
    const toolName = call.function.name;

    emitTraceEvent(traceOptions, 'executor-tool-start', {
      toolName,
      index,
      traceId: traceOptions?.traceId ?? null,
    });

    // Parse args
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(call.function.arguments) as Record<string, unknown>;
    } catch {
      emitTraceEvent(traceOptions, 'executor-tool-failure', {
        toolName,
        index,
        reason: 'arg-parse-failure',
      });
      return {
        success: false,
        actions,
        objectsAffected,
        toolOutputs,
        error: `Failed to parse arguments for tool ${toolName}`,
      };
    }

    if (toolName === 'createStickyNote' && typeof args.text === 'string' && args.text.trim().length === 0) {
      args = { ...args, text: 'New note' };
    }

    // Validate args before hitting the bridge
    const validation = validateArgs(toolName, args);
    if (!validation.valid) {
      emitTraceEvent(traceOptions, 'executor-tool-failure', {
        toolName,
        index,
        reason: 'validation-failure',
        error: validation.error ?? `Invalid args for ${toolName}`,
      });
      return {
        success: false,
        actions,
        objectsAffected,
        toolOutputs,
        error: validation.error ?? `Invalid args for ${toolName}`,
      };
    }

    // getBoardState is read-only — uses board-state bridge endpoint
    if (toolName === 'getBoardState') {
      try {
        const boardStateContext = toBoardStateScopeContext(args);
        const state = await callBridgeBoardState(boardId, boardStateContext, traceOptions?.traceId);
        actions.push({ tool: toolName, args, result: `Returned ${state.returnedCount} of ${state.totalObjects} objects` });
        toolOutputs.push({
          toolCallId: call.id,
          tool: toolName,
          output: state,
        });
        emitTraceEvent(traceOptions, 'executor-tool-success', {
          toolName,
          index,
          returnedCount: state.returnedCount,
          totalObjects: state.totalObjects,
          hasContext: Boolean(boardStateContext),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bridge request failed';
        emitTraceEvent(traceOptions, 'executor-tool-failure', {
          toolName,
          index,
          reason: 'bridge-state-failure',
          error: message,
        });
        return { success: false, actions, objectsAffected, toolOutputs, error: message };
      }
      continue;
    }

    if (toolName === 'findObjects') {
      try {
        const query = toFindObjectsQuery(args);
        const result = await callBridgeFindObjects(boardId, query, traceOptions?.traceId);
        actions.push({
          tool: toolName,
          args,
          result: `Found ${result.returnedCount} objects`,
        });
        toolOutputs.push({
          toolCallId: call.id,
          tool: toolName,
          output: result,
        });
        emitTraceEvent(traceOptions, 'executor-tool-success', {
          toolName,
          index,
          returnedCount: result.returnedCount,
          totalObjects: result.totalObjects,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bridge request failed';
        emitTraceEvent(traceOptions, 'executor-tool-failure', {
          toolName,
          index,
          reason: 'bridge-find-objects-failure',
          error: message,
        });
        return { success: false, actions, objectsAffected, toolOutputs, error: message };
      }
      continue;
    }

    // Mutation tools
    if (!MUTATION_TOOLS.has(toolName)) {
      emitTraceEvent(traceOptions, 'executor-tool-failure', {
        toolName,
        index,
        reason: 'unknown-tool',
      });
      return { success: false, actions, objectsAffected, toolOutputs, error: `Unknown tool: ${toolName}` };
    }

    const mutationBatch: Array<{
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }> = [{ toolCallId: call.id, toolName, args }];

    for (let lookahead = index + 1; lookahead < toolCalls.length; lookahead += 1) {
      const nextCall = toolCalls[lookahead];
      const nextToolName = nextCall.function.name;
      if (nextToolName === 'getBoardState' || nextToolName === 'findObjects') break;
      if (!MUTATION_TOOLS.has(nextToolName)) break;

      let nextArgs: Record<string, unknown>;
      try {
        nextArgs = JSON.parse(nextCall.function.arguments) as Record<string, unknown>;
      } catch {
        break;
      }

      if (
        nextToolName === 'createStickyNote'
        && typeof nextArgs.text === 'string'
        && nextArgs.text.trim().length === 0
      ) {
        nextArgs = { ...nextArgs, text: 'New note' };
      }

      const nextValidation = validateArgs(nextToolName, nextArgs);
      if (!nextValidation.valid) break;

      mutationBatch.push({
        toolCallId: nextCall.id,
        toolName: nextToolName,
        args: nextArgs,
      });
    }

    if (mutationBatch.length >= BULK_MUTATION_BATCH_THRESHOLD) {
      let shouldFallbackToSequential = false;
      emitTraceEvent(traceOptions, 'executor-batch-attempt', {
        batchSize: mutationBatch.length,
        startIndex: index,
      });
      try {
        const batchResponse = await callBridgeMutateBatch(
          boardId,
          userId,
          mutationBatch.map((item) => ({ tool: item.toolName, args: item.args })),
          traceOptions?.traceId,
        );

        const batchResults = Array.isArray(batchResponse.results) ? batchResponse.results : [];
        const appliedCount = Math.min(batchResults.length, mutationBatch.length);
        if (Array.isArray(batchResponse.objects)) {
          inlineCreatedObjects.push(...(batchResponse.objects as Array<Record<string, unknown>>));
        }

        for (let offset = 0; offset < appliedCount; offset += 1) {
          const batchCall = mutationBatch[offset];
          const result = batchResults[offset];
          const affectedIds = result?.affectedObjectIds ?? [];
          objectsAffected.push(...affectedIds);
          actions.push({
            tool: batchCall.toolName,
            args: batchCall.args,
            result: `Affected: ${affectedIds.join(', ')}`,
          });
          toolOutputs.push({
            toolCallId: batchCall.toolCallId,
            tool: batchCall.toolName,
            output: { success: !result?.error, affectedObjectIds: affectedIds, ...(result?.error ? { error: result.error } : {}) },
          });
        }

        if (!batchResponse.success) {
          emitTraceEvent(traceOptions, 'executor-tool-failure', {
            toolName: 'mutate-batch',
            index,
            reason: 'batch-failure',
            error: batchResponse.error ?? 'Bridge batch error',
          });
          return {
            success: false,
            actions,
            objectsAffected,
            toolOutputs,
            error: batchResponse.error ?? 'Bridge batch error',
          };
        }

        if (batchResults.length !== mutationBatch.length) {
          emitTraceEvent(traceOptions, 'executor-tool-failure', {
            toolName: 'mutate-batch',
            index,
            reason: 'batch-shape-mismatch',
          });
          return {
            success: false,
            actions,
            objectsAffected,
            toolOutputs,
            error: 'Bridge batch response shape mismatch',
          };
        }

        emitTraceEvent(traceOptions, 'executor-batch-success', {
          batchSize: mutationBatch.length,
          appliedCount,
        });
        index += mutationBatch.length - 1;
        continue;
      } catch {
        shouldFallbackToSequential = true;
      }

      if (shouldFallbackToSequential) {
        emitTraceEvent(traceOptions, 'executor-batch-fallback', {
          batchSize: mutationBatch.length,
          reason: 'batch-exception',
        });
        for (const batchCall of mutationBatch) {
          try {
            const bridgeResult = await callBridgeMutate(
              boardId,
              userId,
              batchCall.toolName,
              batchCall.args,
              traceOptions?.traceId,
            );
            if (!bridgeResult.success) {
              emitTraceEvent(traceOptions, 'executor-tool-failure', {
                toolName: batchCall.toolName,
                index,
                reason: 'bridge-mutation-failure',
                error: bridgeResult.error ?? `Bridge error on tool ${batchCall.toolName}`,
              });
              return {
                success: false,
                actions,
                objectsAffected,
                toolOutputs,
                error: bridgeResult.error ?? `Bridge error on tool ${batchCall.toolName}`,
              };
            }
            objectsAffected.push(...bridgeResult.affectedObjectIds);
            if (Array.isArray(bridgeResult.objects)) {
              inlineCreatedObjects.push(...bridgeResult.objects);
            }
            actions.push({
              tool: batchCall.toolName,
              args: batchCall.args,
              result: `Affected: ${bridgeResult.affectedObjectIds.join(', ')}`,
            });
            toolOutputs.push({
              toolCallId: batchCall.toolCallId,
              tool: batchCall.toolName,
              output: bridgeResult,
            });
            emitTraceEvent(traceOptions, 'executor-tool-success', {
              toolName: batchCall.toolName,
              index,
              affectedCount: bridgeResult.affectedObjectIds.length,
              viaFallback: true,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Bridge request failed';
            emitTraceEvent(traceOptions, 'executor-tool-failure', {
              toolName: batchCall.toolName,
              index,
              reason: 'bridge-request-failure',
              error: message,
              viaFallback: true,
            });
            return { success: false, actions, objectsAffected, toolOutputs, error: message };
          }
        }

        index += mutationBatch.length - 1;
        continue;
      }
    }

    try {
      const bridgeResult = await callBridgeMutate(boardId, userId, toolName, args, traceOptions?.traceId);
      if (!bridgeResult.success) {
        emitTraceEvent(traceOptions, 'executor-tool-failure', {
          toolName,
          index,
          reason: 'bridge-mutation-failure',
          error: bridgeResult.error ?? `Bridge error on tool ${toolName}`,
        });
        return {
          success: false,
          actions,
          objectsAffected,
          toolOutputs,
          error: bridgeResult.error ?? `Bridge error on tool ${toolName}`,
        };
      }
      objectsAffected.push(...bridgeResult.affectedObjectIds);
      if (Array.isArray(bridgeResult.objects)) {
        inlineCreatedObjects.push(...bridgeResult.objects);
      }
      actions.push({ tool: toolName, args, result: `Affected: ${bridgeResult.affectedObjectIds.join(', ')}` });
      toolOutputs.push({
        toolCallId: call.id,
        tool: toolName,
        output: bridgeResult,
      });
      emitTraceEvent(traceOptions, 'executor-tool-success', {
        toolName,
        index,
        affectedCount: bridgeResult.affectedObjectIds.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bridge request failed';
      emitTraceEvent(traceOptions, 'executor-tool-failure', {
        toolName,
        index,
        reason: 'bridge-request-failure',
        error: message,
      });
      return { success: false, actions, objectsAffected, toolOutputs, error: message };
    }
  }

  emitTraceEvent(traceOptions, 'executor-complete', {
    actionCount: actions.length,
    objectsAffectedCount: objectsAffected.length,
  });

  return {
    success: true,
    actions,
    objectsAffected,
    toolOutputs,
    ...(inlineCreatedObjects.length > 0 ? { inlineCreatedObjects } : {}),
  };
}
