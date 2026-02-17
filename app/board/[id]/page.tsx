import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';

// Load Canvas only on client side to avoid hydration mismatch
const Canvas = dynamic(() => import('@/components/board/Canvas').then((mod) => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">Loading canvas...</div>
    </div>
  ),
});

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

  return <Canvas boardId={board.id} />;
}
