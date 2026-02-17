import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { BoardCanvas } from '@/components/board/BoardCanvas';

interface BoardPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: board, error } = await supabase
    .from('boards')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !board) {
    notFound();
  }

  return <BoardCanvas boardId={board.id} />;
}
