import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { AI_TOOLS } from '@/lib/ai-agent/tools';
import { executeToolCalls } from '@/lib/ai-agent/executor';
import { createTracedCompletion } from '@/lib/ai-agent/tracing';
import type { ToolCallInput } from '@/lib/ai-agent/executor';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

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

    // Call OpenAI with tool-calling (traced via tracing adapter from 1.3 reference pattern)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const baseMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: command.trim() },
    ];

    const completion = await createTracedCompletion(
      openai,
      {
        model: 'gpt-4o-mini',
        messages: baseMessages,
        tools: AI_TOOLS,
        tool_choice: 'auto',
      },
      'ai-board-command',
    );

    const responseMessage = completion.choices[0]?.message;
    const firstToolCalls = toToolCallInputs(
      (responseMessage?.tool_calls as Array<{ id: string; type: string; function?: { name: string; arguments: string } }> | undefined),
    );

    // No tool calls — model declined to act (command not board-related)
    if (firstToolCalls.length === 0) {
      return NextResponse.json({
        success: true,
        actions: [],
        objectsAffected: [],
      });
    }

    const executionResult = await executeToolCalls(firstToolCalls, boardId.trim(), user.id);

    // If the first pass only retrieved board state, run one follow-up completion
    // with scoped board context so the model can emit mutation tool calls.
    const hadOnlyReadStatePass =
      executionResult.success &&
      executionResult.objectsAffected.length === 0 &&
      executionResult.toolOutputs.length > 0 &&
      executionResult.toolOutputs.every((output) => output.tool === 'getBoardState');

    if (!hadOnlyReadStatePass) {
      return NextResponse.json({
        success: executionResult.success,
        actions: executionResult.actions,
        objectsAffected: executionResult.objectsAffected,
        ...(executionResult.error ? { error: executionResult.error } : {}),
      });
    }

    const latestBoardState = executionResult.toolOutputs.at(-1)?.output;
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
      'ai-board-command-followup',
    );

    const secondResponseMessage = secondCompletion.choices[0]?.message;
    const secondToolCalls = toToolCallInputs(
      (secondResponseMessage?.tool_calls as Array<{ id: string; type: string; function?: { name: string; arguments: string } }> | undefined),
    );

    if (secondToolCalls.length === 0) {
      return NextResponse.json({
        success: executionResult.success,
        actions: executionResult.actions,
        objectsAffected: executionResult.objectsAffected,
      });
    }

    const secondExecution = await executeToolCalls(secondToolCalls, boardId.trim(), user.id);
    const combinedSuccess = executionResult.success && secondExecution.success;
    const combinedActions = [...executionResult.actions, ...secondExecution.actions];
    const combinedObjectsAffected = [...executionResult.objectsAffected, ...secondExecution.objectsAffected];

    return NextResponse.json({
      success: combinedSuccess,
      actions: combinedActions,
      objectsAffected: combinedObjectsAffected,
      ...(secondExecution.error ? { error: secondExecution.error } : {}),
    });
  } catch (err) {
    console.error('[AI Command] Unexpected error:', err);
    return NextResponse.json(
      { success: false, actions: [], objectsAffected: [], error: 'Internal server error' },
      { status: 500 },
    );
  }
}
