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
        className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
      >
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            className={`
              inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium transition-colors
              ${
                selectedTool === tool.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }
            `}
            title={tool.label}
            aria-label={tool.label}
          >
            <span className="text-lg">{tool.icon}</span>
          </button>
        ))}

        <div className="my-1 h-px w-full bg-gray-200" />

        <button
          onClick={onUndo}
          className={`
            inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium transition-colors
            ${
              canUndo
                ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
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
            inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium transition-colors
            ${
              canRedo
                ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
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
        <div className="absolute left-full top-0 ml-2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
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
            <label className="flex items-center gap-2 text-xs text-gray-600" title="Pencil width">
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
