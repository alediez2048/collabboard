import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

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

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{board.name}</h1>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <p className="text-gray-500 text-lg">
              Canvas will go here (TICKET-02)
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Board ID: {board.id}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
