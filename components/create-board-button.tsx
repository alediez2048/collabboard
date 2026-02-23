'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CreateBoardButtonProps {
  userId: string;
  label?: string;
  className?: string;
  dataTestId?: string;
}

const DEFAULT_BUTTON_CLASS =
  'nb-btn inline-flex items-center px-4 py-2 text-sm font-bold uppercase text-black bg-[var(--nb-accent-blue)] disabled:opacity-50 disabled:cursor-not-allowed';

export function CreateBoardButton({
  userId,
  label = '+ Create Board',
  className,
  dataTestId,
}: CreateBoardButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCreateBoard = async (): Promise<void> => {
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
      type="button"
      onClick={handleCreateBoard}
      disabled={loading}
      data-testid={dataTestId}
      className={className ?? DEFAULT_BUTTON_CLASS}
    >
      {loading ? 'Creating...' : label}
    </button>
  );
}
