import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BoardCanvas } from '@/components/board/BoardCanvas';
import { JoinBoardPrompt } from '@/components/board/JoinBoardPrompt';

interface BoardPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Ensure user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Try to fetch the board (RLS will allow if owner OR member)
  const { data: board } = await supabase
    .from('boards')
    .select('id, name, created_by')
    .eq('id', id)
    .single();

  // Board accessible — render it
  if (board) {
    const openedAt = new Date().toISOString();
    const { error: stateError } = await supabase
      .from('board_user_state')
      .upsert(
        {
          board_id: board.id,
          user_id: user.id,
          last_opened_at: openedAt,
          updated_at: openedAt,
        },
        { onConflict: 'board_id,user_id' },
      );

    if (stateError) {
      console.error(`[Board Discovery] Failed to record recent activity for ${board.id}:`, stateError);
    }

    return <BoardCanvas boardId={board.id} boardName={board.name} />;
  }

  // Board not accessible via RLS — check if it actually exists by trying
  // to join. We show a join prompt rather than a hard 404 so collaborators
  // can self-onboard via the shared link.
  return <JoinBoardPrompt boardId={id} />;
}
