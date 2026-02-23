'use client';

import type { BoardTool } from '@/lib/utils/board-authoring';
import { useUIStore } from '@/stores/ui-store';

interface ToolbarProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  pencilColor?: string;
  pencilStrokeWidth?: number;
  onPencilColorChange?: (color: string) => void;
  onPencilStrokeWidthChange?: (width: number) => void;
}

export function Toolbar({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  pencilColor = '#1d4ed8',
  pencilStrokeWidth = 3,
  onPencilColorChange,
  onPencilStrokeWidthChange,
}: ToolbarProps) {
  const { selectedTool, setSelectedTool } = useUIStore();

  const tools: Array<{ id: BoardTool; label: string; icon: string }> = [
    { id: 'select', label: 'Select', icon: '⌖' },
    { id: 'hand', label: 'Hand', icon: '✋' },
    { id: 'comment', label: 'Comment', icon: '💬' },
    { id: 'pencil', label: 'Pencil', icon: '✎' },
    { id: 'eraser', label: 'Eraser', icon: '⌫' },
    { id: 'sticky', label: 'Sticky Note', icon: '📝' },
    { id: 'rectangle', label: 'Rectangle', icon: '▭' },
    { id: 'circle', label: 'Circle', icon: '○' },
    { id: 'line', label: 'Line', icon: '╱' },
    { id: 'connector', label: 'Connector', icon: '↗' },
    { id: 'frame', label: 'Frame', icon: '⬚' },
    { id: 'text', label: 'Text', icon: 'T' },
  ];

  return (
    <div className="absolute left-4 top-20 z-20">
      <div
        data-testid="board-toolbar"
        className="flex flex-col items-center gap-1 rounded-lg border-2 border-black bg-white p-2 shadow-[4px_4px_0px_#000]"
      >
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            className={`
              inline-flex h-10 w-10 items-center justify-center rounded-md border-2 text-sm font-bold transition-colors
              ${
                selectedTool === tool.id
                  ? 'bg-[var(--nb-accent-blue)] text-black border-black'
                  : 'bg-white text-black border-transparent hover:border-black hover:bg-[var(--nb-bg)]'
              }
            `}
            title={tool.label}
            aria-label={tool.label}
          >
            <span className="text-lg">{tool.icon}</span>
          </button>
        ))}

        <div className="my-1 h-0.5 w-full bg-black" />

        <button
          onClick={onUndo}
          className={`
            inline-flex h-10 w-10 items-center justify-center rounded-md border-2 text-sm font-bold transition-colors
            ${
              canUndo
                ? 'bg-white text-black border-transparent hover:border-black hover:bg-[var(--nb-bg)]'
                : 'bg-white text-[var(--nb-text-muted)] border-transparent cursor-not-allowed'
            }
          `}
          title="Undo"
          aria-label="Undo"
          disabled={!canUndo}
        >
          <span className="text-lg">↶</span>
        </button>

        <button
          onClick={onRedo}
          className={`
            inline-flex h-10 w-10 items-center justify-center rounded-md border-2 text-sm font-bold transition-colors
            ${
              canRedo
                ? 'bg-white text-black border-transparent hover:border-black hover:bg-[var(--nb-bg)]'
                : 'bg-white text-[var(--nb-text-muted)] border-transparent cursor-not-allowed'
            }
          `}
          title="Redo"
          aria-label="Redo"
          disabled={!canRedo}
        >
          <span className="text-lg">↷</span>
        </button>
      </div>

      {selectedTool === 'pencil' && onPencilColorChange && onPencilStrokeWidthChange && (
        <div className="absolute left-full top-0 ml-2 rounded-lg border-2 border-black bg-white p-3 shadow-[4px_4px_0px_#000]">
          <div className="flex items-center gap-3">
            <label className="flex items-center" title="Pencil color">
              <span className="sr-only">Pencil color</span>
              <input
                type="color"
                value={pencilColor}
                onChange={(event) => onPencilColorChange(event.target.value)}
                className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0"
                aria-label="Pencil color"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-black" title="Pencil width">
              <span>Width</span>
              <input
                type="range"
                min={1}
                max={16}
                step={1}
                value={pencilStrokeWidth}
                onChange={(event) => onPencilStrokeWidthChange(Number(event.target.value))}
                aria-label="Pencil width"
              />
              <span className="w-6 text-right tabular-nums">{pencilStrokeWidth}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
