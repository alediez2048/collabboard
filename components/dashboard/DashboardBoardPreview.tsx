import type { ReactElement } from 'react';
import type { DashboardBoardThumbnail } from '@/types/board';

interface DashboardBoardPreviewProps {
  boardId: string;
  thumbnail?: DashboardBoardThumbnail;
}

const STATUS_LABELS: Record<DashboardBoardThumbnail['status'], string> = {
  snapshot: 'Snapshot preview',
  empty: 'No objects yet',
  placeholder: 'Preview pending',
  error: 'Preview unavailable',
};

const STATUS_BADGE_STYLES: Record<DashboardBoardThumbnail['status'], string> = {
  snapshot: 'bg-white text-black border-2 border-black',
  empty: 'bg-[var(--nb-accent-blue)] text-black border-2 border-black',
  placeholder: 'bg-white text-black border-2 border-black',
  error: 'bg-[var(--nb-accent-red)] text-black border-2 border-black',
};

export function DashboardBoardPreview({
  boardId,
  thumbnail,
}: DashboardBoardPreviewProps): ReactElement {
  const preview = thumbnail ?? {
    status: 'placeholder',
    objectCount: 0,
    snapshotAt: null,
    shapes: [],
  };

  return (
    <div
      data-testid={`board-preview-${boardId}`}
      className="relative h-full min-h-28 overflow-hidden rounded-lg border-2 border-black"
      aria-label={STATUS_LABELS[preview.status]}
    >
      <div className="absolute inset-0" style={{ background: 'var(--nb-bg)' }} />
      {preview.shapes.map((shape) => (
        <span
          key={`${boardId}-${shape.id}`}
          className="absolute border-2 border-black"
          style={{
            left: `${shape.x}%`,
            top: `${shape.y}%`,
            width: `${shape.width}%`,
            height: `${shape.height}%`,
            backgroundColor: shape.color,
            borderRadius: `${shape.borderRadius}px`,
          }}
        />
      ))}

      <div className="absolute inset-0" />
      <span
        className={`absolute bottom-2 left-2 inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE_STYLES[preview.status]}`}
      >
        {STATUS_LABELS[preview.status]}
      </span>
    </div>
  );
}
