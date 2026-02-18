import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
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
