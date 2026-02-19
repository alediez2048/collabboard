import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { AI_TOOLS } from '@/lib/ai-agent/tools';
import { executeToolCalls } from '@/lib/ai-agent/executor';
import { createTracedCompletion } from '@/lib/ai-agent/tracing';
import type { ToolCallInput } from '@/lib/ai-agent/executor';

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

    const completion = await createTracedCompletion(
      openai,
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: command.trim() },
        ],
        tools: AI_TOOLS,
        tool_choice: 'auto',
      },
      'ai-board-command',
    );

    const responseMessage = completion.choices[0]?.message;
    const toolCalls = responseMessage?.tool_calls;

    // No tool calls — model declined to act (command not board-related)
    if (!toolCalls || toolCalls.length === 0) {
      return NextResponse.json({
        success: true,
        actions: [],
        objectsAffected: [],
      });
    }

    // Execute tool calls sequentially via realtime bridge.
    // Filter to standard function calls only (guard against custom tool call variants).
    const toolCallInputs: ToolCallInput[] = toolCalls
      .filter((tc): tc is typeof tc & { type: 'function'; function: { name: string; arguments: string } } =>
        tc.type === 'function' && 'function' in tc,
      )
      .map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

    const executionResult = await executeToolCalls(toolCallInputs, boardId.trim(), user.id);

    return NextResponse.json({
      success: executionResult.success,
      actions: executionResult.actions,
      objectsAffected: executionResult.objectsAffected,
      ...(executionResult.error ? { error: executionResult.error } : {}),
    });
  } catch (err) {
    console.error('[AI Command] Unexpected error:', err);
    return NextResponse.json(
      { success: false, actions: [], objectsAffected: [], error: 'Internal server error' },
      { status: 500 },
    );
  }
}
