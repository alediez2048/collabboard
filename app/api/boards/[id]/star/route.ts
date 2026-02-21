import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ToggleStarRequestBody {
  isStarred: boolean;
}

function isToggleStarRequestBody(value: unknown): value is ToggleStarRequestBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { isStarred?: unknown };
  return typeof candidate.isStarred === 'boolean';
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { id: boardId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: unknown = await request.json().catch(() => null);
    if (!isToggleStarRequestBody(payload)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('id', boardId)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const timestamp = new Date().toISOString();
    const { data: state, error: upsertError } = await supabase
      .from('board_user_state')
      .upsert(
        {
          board_id: boardId,
          user_id: user.id,
          is_starred: payload.isStarred,
          updated_at: timestamp,
        },
        { onConflict: 'board_id,user_id' },
      )
      .select('board_id, user_id, is_starred, last_opened_at, updated_at')
      .single();

    if (upsertError || !state) {
      console.error('[Star Board] Failed to persist star state:', upsertError);
      return NextResponse.json({ error: 'Failed to update board star state' }, { status: 500 });
    }

    return NextResponse.json({ state }, { status: 200 });
  } catch (error) {
    console.error('[Star Board] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
