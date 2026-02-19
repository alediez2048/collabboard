import {
  validateCreateStickyNoteArgs,
  validateCreateShapeArgs,
  validateCreateFrameArgs,
  validateCreateConnectorArgs,
  validateMoveObjectArgs,
  validateUpdateTextArgs,
  validateChangeColorArgs,
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

export interface ExecutionResult {
  success: boolean;
  actions: ActionRecord[];
  objectsAffected: string[];
  error?: string;
}

interface BridgeMutateResponse {
  success: boolean;
  affectedObjectIds: string[];
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
  'updateText',
  'changeColor',
]);

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

  for (const call of toolCalls) {
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
        error: validation.error ?? `Invalid args for ${toolName}`,
      };
    }

    // getBoardState is read-only — uses board-state bridge endpoint
    if (toolName === 'getBoardState') {
      try {
        const state = await callBridgeBoardState(boardId);
        actions.push({ tool: toolName, args, result: `Returned ${state.returnedCount} of ${state.totalObjects} objects` });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bridge request failed';
        return { success: false, actions, objectsAffected, error: message };
      }
      continue;
    }

    // Mutation tools
    if (!MUTATION_TOOLS.has(toolName)) {
      return { success: false, actions, objectsAffected, error: `Unknown tool: ${toolName}` };
    }

    try {
      const bridgeResult = await callBridgeMutate(boardId, userId, toolName, args);
      if (!bridgeResult.success) {
        return {
          success: false,
          actions,
          objectsAffected,
          error: bridgeResult.error ?? `Bridge error on tool ${toolName}`,
        };
      }
      objectsAffected.push(...bridgeResult.affectedObjectIds);
      actions.push({ tool: toolName, args, result: `Affected: ${bridgeResult.affectedObjectIds.join(', ')}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bridge request failed';
      return { success: false, actions, objectsAffected, error: message };
    }
  }

  return { success: true, actions, objectsAffected };
}
