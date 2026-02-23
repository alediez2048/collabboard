'use client';

import dynamic from 'next/dynamic';

// Load Canvas only on client side to avoid hydration mismatch
const Canvas = dynamic(() => import('./Canvas').then((mod) => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--nb-bg)' }}>
      <div className="text-black font-bold text-lg">Loading canvas...</div>
    </div>
  ),
});

interface BoardCanvasProps {
  boardId: string;
  boardName: string;
  boardOwnerId: string;
}

export function BoardCanvas({ boardId, boardName, boardOwnerId }: BoardCanvasProps) {
  return <Canvas boardId={boardId} boardName={boardName} boardOwnerId={boardOwnerId} />;
}
