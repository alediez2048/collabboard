import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/boards/[id]/join
 * Adds the authenticated user as a member (editor) of the board.
 * Safe to call multiple times — ignores duplicate inserts.
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id: boardId } = await params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check that the board actually exists (public check — no RLS filter on existence)
    // We use a service-level check via the boards table. If the user is already owner
    // they'll succeed the boards select; otherwise we still need to confirm the board exists.
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id, name, created_by')
      .eq('id', boardId)
      .maybeSingle();

    // If the board doesn't exist at all (not just hidden by RLS), 404
    // Note: if RLS hides it from the current user we still get null here,
    // so we need to allow the join regardless and let the DB enforce access.
    // We'll use upsert to add the member row and let it succeed or fail cleanly.

    // Don't allow owner to add themselves (they already have full access)
    if (board && board.created_by === user.id) {
      return NextResponse.json(
        { message: 'You are the owner of this board', boardId },
        { status: 200 }
      );
    }

    // Add user as a board member (upsert to handle duplicates gracefully)
    const { error: insertError } = await supabase
      .from('board_members')
      .upsert(
        { board_id: boardId, user_id: user.id, role: 'editor' },
        { onConflict: 'board_id,user_id', ignoreDuplicates: true }
      );

    if (insertError) {
      console.error('[Join Board] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to join board' }, { status: 500 });
    }

    // Fetch the board name to return to client (now user has access via RLS)
    const { data: joinedBoard, error: fetchError } = await supabase
      .from('boards')
      .select('id, name')
      .eq('id', boardId)
      .single();

    if (fetchError || !joinedBoard) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    console.log(`[Join Board] User ${user.email} joined board: ${boardId}`);

    return NextResponse.json(
      { message: 'Joined successfully', boardId: joinedBoard.id, boardName: joinedBoard.name },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Join Board] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
