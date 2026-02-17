import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Board } from '@/types/board';
import { CreateBoardButton } from '@/components/create-board-button';

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all boards the user can access (owned + shared via RLS policy)
  const { data: boards, error } = await supabase
    .from('boards')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching boards:', error);
  }

  const ownedBoards = boards?.filter((b: Board) => b.created_by === user.id) ?? [];
  const sharedBoards = boards?.filter((b: Board) => b.created_by !== user.id) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Boards</h1>
          <CreateBoardButton userId={user.id} />
        </div>

        {/* Owned boards */}
        {ownedBoards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {ownedBoards.map((board: Board) => (
              <Link
                key={board.id}
                href={`/board/${board.id}`}
                className="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {board.name}
                </h2>
                <p className="text-sm text-gray-500">
                  Created {new Date(board.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 mb-8">
            <p className="text-gray-500 mb-4">No boards yet. Create your first board to get started!</p>
          </div>
        )}

        {/* Shared boards */}
        {sharedBoards.length > 0 && (
          <>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Shared with me</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedBoards.map((board: Board) => (
                <Link
                  key={board.id}
                  href={`/board/${board.id}`}
                  className="block p-6 bg-white rounded-lg shadow-sm border border-blue-100 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {board.name}
                    </h2>
                    <span className="text-xs bg-blue-100 text-blue-600 font-medium px-2 py-0.5 rounded-full ml-2 shrink-0">
                      Shared
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Joined {new Date(board.created_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
