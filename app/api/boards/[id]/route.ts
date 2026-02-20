import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RenameBoardRequestBody {
  name: string;
}

function isRenameBoardRequestBody(value: unknown): value is RenameBoardRequestBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { name?: unknown };
  return typeof candidate.name === 'string';
}

/**
 * DELETE /api/boards/[id]
 * Deletes a board. Only the board owner is allowed to delete it.
 * The board_snapshots row is removed via ON DELETE CASCADE in the DB.
 */
export async function DELETE(
  _request: NextRequest,
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

    // Verify ownership before deleting. RLS also enforces this, but an
    // explicit check gives a clearer error message.
    const { data: board, error: fetchError } = await supabase
      .from('boards')
      .select('id, created_by')
      .eq('id', boardId)
      .single();

    if (fetchError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    if (board.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the board owner can delete this board' },
        { status: 403 },
      );
    }

    const { error: deleteError } = await supabase
      .from('boards')
      .delete()
      .eq('id', boardId);

    if (deleteError) {
      console.error('[Delete Board] Error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete board' }, { status: 500 });
    }

    console.log(`[Delete Board] User ${user.email} deleted board: ${boardId}`);
    return NextResponse.json({ message: 'Board deleted' }, { status: 200 });
  } catch (error) {
    console.error('[Delete Board] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/boards/[id]
 * Renames a board. Only the board owner is allowed to rename it.
 */
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
    if (!isRenameBoardRequestBody(payload)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const nextName = payload.name.trim();
    if (nextName.length === 0) {
      return NextResponse.json({ error: 'Board name cannot be empty.' }, { status: 400 });
    }

    if (nextName.length > 100) {
      return NextResponse.json(
        { error: 'Board name must be 100 characters or fewer.' },
        { status: 400 },
      );
    }

    const { data: board, error: fetchError } = await supabase
      .from('boards')
      .select('id, created_by')
      .eq('id', boardId)
      .single();

    if (fetchError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    if (board.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the board owner can rename this board' },
        { status: 403 },
      );
    }

    const { data: updatedBoard, error: updateError } = await supabase
      .from('boards')
      .update({ name: nextName })
      .eq('id', boardId)
      .select('id, name, created_by, created_at')
      .single();

    if (updateError || !updatedBoard) {
      console.error('[Rename Board] Error:', updateError);
      return NextResponse.json({ error: 'Failed to rename board' }, { status: 500 });
    }

    return NextResponse.json({ board: updatedBoard }, { status: 200 });
  } catch (error) {
    console.error('[Rename Board] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
