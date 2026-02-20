import {
  validateCreateStickyNoteArgs,
  validateCreateShapeArgs,
  validateCreateFrameArgs,
  validateCreateConnectorArgs,
  validateMoveObjectArgs,
  validateUpdateTextArgs,
  validateChangeColorArgs,
  validateResizeObjectArgs,
} from '@/lib/ai-agent/tools';
import type { ScopedBoardState } from '@/lib/ai-agent/scoped-state';

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
  error?: string;
}

interface BridgeMutateResponse {
  success: boolean;
  affectedObjectIds: string[];
  error?: string;
}

interface BridgeBatchResult {
  affectedObjectIds: string[];
  error?: string;
}

interface BridgeBatchMutateResponse {
  success: boolean;
  results?: BridgeBatchResult[];
  failedIndex?: number;
  error?: string;
}

interface BridgeStateResponse extends ScopedBoardState {
  error?: string;
}

function getRealtimeServerUrl(): string {
  return process.env.REALTIME_SERVER_URL ?? 'http://localhost:4000';
}

function getBridgeSecret(): string {
  return process.env.AI_BRIDGE_SECRET ?? '';
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
    default: return { valid: false, error: `Unknown tool: ${toolName}` };
  }
}

async function callBridgeMutate(
  boardId: string,
  userId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<BridgeMutateResponse> {
  const url = `${getRealtimeServerUrl()}/ai/mutate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getBridgeSecret()}`,
    },
    body: JSON.stringify({ boardId, userId, action: { tool, args } }),
  });
  return res.json() as Promise<BridgeMutateResponse>;
}

async function callBridgeMutateBatch(
  boardId: string,
  userId: string,
  actions: Array<{ tool: string; args: Record<string, unknown> }>,
): Promise<BridgeBatchMutateResponse> {
  const url = `${getRealtimeServerUrl()}/ai/mutate-batch`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getBridgeSecret()}`,
    },
    body: JSON.stringify({ boardId, userId, actions }),
  });
  return res.json() as Promise<BridgeBatchMutateResponse>;
}

async function callBridgeBoardState(
  boardId: string,
): Promise<BridgeStateResponse> {
  const url = `${getRealtimeServerUrl()}/ai/board-state`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getBridgeSecret()}`,
    },
    body: JSON.stringify({ boardId }),
  });
  return res.json() as Promise<BridgeStateResponse>;
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
): Promise<ExecutionResult> {
  const actions: ActionRecord[] = [];
  const objectsAffected: string[] = [];
  const toolOutputs: ToolOutputRecord[] = [];

  for (let index = 0; index < toolCalls.length; index += 1) {
    const call = toolCalls[index];
    const toolName = call.function.name;

    // Parse args
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(call.function.arguments) as Record<string, unknown>;
    } catch {
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
        const state = await callBridgeBoardState(boardId);
        actions.push({ tool: toolName, args, result: `Returned ${state.returnedCount} of ${state.totalObjects} objects` });
        toolOutputs.push({
          toolCallId: call.id,
          tool: toolName,
          output: state,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bridge request failed';
        return { success: false, actions, objectsAffected, toolOutputs, error: message };
      }
      continue;
    }

    // Mutation tools
    if (!MUTATION_TOOLS.has(toolName)) {
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
      if (nextToolName === 'getBoardState') break;
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
      try {
        const batchResponse = await callBridgeMutateBatch(
          boardId,
          userId,
          mutationBatch.map((item) => ({ tool: item.toolName, args: item.args })),
        );

        const batchResults = Array.isArray(batchResponse.results) ? batchResponse.results : [];
        const appliedCount = Math.min(batchResults.length, mutationBatch.length);

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
          return {
            success: false,
            actions,
            objectsAffected,
            toolOutputs,
            error: batchResponse.error ?? 'Bridge batch error',
          };
        }

        if (batchResults.length !== mutationBatch.length) {
          return {
            success: false,
            actions,
            objectsAffected,
            toolOutputs,
            error: 'Bridge batch response shape mismatch',
          };
        }

        index += mutationBatch.length - 1;
        continue;
      } catch {
        shouldFallbackToSequential = true;
      }

      if (shouldFallbackToSequential) {
        for (const batchCall of mutationBatch) {
          try {
            const bridgeResult = await callBridgeMutate(
              boardId,
              userId,
              batchCall.toolName,
              batchCall.args,
            );
            if (!bridgeResult.success) {
              return {
                success: false,
                actions,
                objectsAffected,
                toolOutputs,
                error: bridgeResult.error ?? `Bridge error on tool ${batchCall.toolName}`,
              };
            }
            objectsAffected.push(...bridgeResult.affectedObjectIds);
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
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Bridge request failed';
            return { success: false, actions, objectsAffected, toolOutputs, error: message };
          }
        }

        index += mutationBatch.length - 1;
        continue;
      }
    }

    try {
      const bridgeResult = await callBridgeMutate(boardId, userId, toolName, args);
      if (!bridgeResult.success) {
        return {
          success: false,
          actions,
          objectsAffected,
          toolOutputs,
          error: bridgeResult.error ?? `Bridge error on tool ${toolName}`,
        };
      }
      objectsAffected.push(...bridgeResult.affectedObjectIds);
      actions.push({ tool: toolName, args, result: `Affected: ${bridgeResult.affectedObjectIds.join(', ')}` });
      toolOutputs.push({
        toolCallId: call.id,
        tool: toolName,
        output: bridgeResult,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bridge request failed';
      return { success: false, actions, objectsAffected, toolOutputs, error: message };
    }
  }

  return { success: true, actions, objectsAffected, toolOutputs };
}
