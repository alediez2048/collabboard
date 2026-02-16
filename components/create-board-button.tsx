'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CreateBoardButtonProps {
  userId: string;
}

export function CreateBoardButton({ userId }: CreateBoardButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCreateBoard = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('boards')
        .insert({
          name: 'Untitled Board',
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        router.push(`/board/${data.id}`);
        router.refresh();
      }
    } catch (error) {
      console.error('Error creating board:', error);
      alert('Failed to create board');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCreateBoard}
      disabled={loading}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Creating...' : '+ Create Board'}
    </button>
  );
}
