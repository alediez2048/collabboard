import { executeToolCalls, type ToolCallInput } from '@/lib/ai-agent/executor';
import { createClient } from '@/lib/supabase/server';
import {
  getTemplateCatalogItem,
  isTemplateId,
  type TemplateId,
  buildTemplateSeedSteps,
} from '@/lib/templates/template-seeds';
import { NextRequest, NextResponse } from 'next/server';

interface TemplateCreateRequestBody {
  template: string;
}

interface CreatedBoard {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

function isTemplateCreateRequestBody(value: unknown): value is TemplateCreateRequestBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { template?: unknown };
  return typeof candidate.template === 'string';
}

function toToolCalls(templateId: TemplateId): ToolCallInput[] {
  return buildTemplateSeedSteps(templateId).map((step, index) => ({
    id: `template-seed-${index + 1}`,
    type: 'function',
    function: {
      name: step.tool,
      arguments: JSON.stringify(step.args),
    },
  }));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: unknown = await request.json().catch(() => null);
    if (!isTemplateCreateRequestBody(payload)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const rawTemplate = payload.template.trim().toLowerCase();
    if (!isTemplateId(rawTemplate)) {
      return NextResponse.json({ error: 'Invalid template value' }, { status: 400 });
    }

    const templateMetadata = getTemplateCatalogItem(rawTemplate);
    const { data: board, error: createError } = await supabase
      .from('boards')
      .insert({
        name: templateMetadata.boardName,
        created_by: user.id,
      })
      .select('id, name, created_by, created_at')
      .single();

    if (createError || !board) {
      console.error('[Template Create] Failed to create board:', createError);
      return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
    }

    const execution = await executeToolCalls(toToolCalls(rawTemplate), board.id, user.id);
    if (!execution.success) {
      const { error: rollbackError } = await supabase
        .from('boards')
        .delete()
        .eq('id', board.id)
        .eq('created_by', user.id);

      if (rollbackError) {
        console.error('[Template Create] Rollback failed:', rollbackError);
      }

      return NextResponse.json(
        {
          error: execution.error ?? 'Failed to seed template board',
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        board: board as CreatedBoard,
        template: rawTemplate,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[Template Create] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
