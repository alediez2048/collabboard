import * as Y from 'yjs';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import {
  getTemplateCatalogItem,
  normalizeTemplateId,
  buildTemplateSeedSteps,
} from '@/lib/templates/template-seeds';
import type { BoardObject } from '@/lib/yjs/board-doc';
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

function getServiceClient(): ReturnType<typeof createClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for template seeding');
  }
  return createClient(url, key);
}

const TOOL_TO_TYPE: Record<string, BoardObject['type']> = {
  createFrame: 'frame',
  createStickyNote: 'sticky_note',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerClient();
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

    const templateId = normalizeTemplateId(payload.template);
    if (!templateId) {
      return NextResponse.json({ error: 'Invalid template value' }, { status: 400 });
    }

    const templateMetadata = getTemplateCatalogItem(templateId);
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

    const steps = buildTemplateSeedSteps(templateId);
    const doc = new Y.Doc();
    const objects = doc.getMap<BoardObject>('objects');
    const now = new Date().toISOString();

    doc.transact(() => {
      steps.forEach((step, index) => {
        const id = crypto.randomUUID();
        const objectType = TOOL_TO_TYPE[step.tool] ?? 'sticky_note';
        const args = step.args;

        const boardObject: BoardObject = {
          id,
          type: objectType,
          x: (args.x as number) ?? 0,
          y: (args.y as number) ?? 0,
          width: (args.width as number) ?? 200,
          height: (args.height as number) ?? 200,
          rotation: 0,
          zIndex: index + 1,
          properties:
            objectType === 'frame'
              ? {
                  title: (args.title as string) ?? '',
                  fillColor: 'rgba(219,234,254,0.25)',
                  strokeColor: '#3b82f6',
                }
              : {
                  text: (args.text as string) ?? '',
                  color: (args.color as string) ?? '#ffeb3b',
                },
          createdBy: user.id,
          updatedAt: now,
        };

        objects.set(id, boardObject);
      });
    });

    const state = Y.encodeStateAsUpdate(doc);
    const hexState = '\\x' + Buffer.from(state).toString('hex');
    doc.destroy();

    const serviceSupabase = getServiceClient();
    const { error: snapError } = await serviceSupabase
      .from('board_snapshots')
      .upsert(
        { board_id: board.id, yjs_state: hexState, snapshot_at: now },
        { onConflict: 'board_id' },
      );

    if (snapError) {
      console.error('[Template Create] Failed to save snapshot:', snapError);
      await supabase
        .from('boards')
        .delete()
        .eq('id', board.id)
        .eq('created_by', user.id);
      return NextResponse.json({ error: 'Failed to seed template board' }, { status: 500 });
    }

    return NextResponse.json(
      {
        board: board as CreatedBoard,
        template: templateId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[Template Create] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
