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
    { id: 'select', label: 'Select', icon: '⌃' },
    { id: 'hand', label: 'Hand', icon: '✋' },
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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${
                selectedTool === tool.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }
            `}
            title={tool.label}
          >
            <span className="text-lg">{tool.icon}</span>
          </button>
        ))}

        {selectedTool === 'pencil' && onPencilColorChange && onPencilStrokeWidthChange && (
          <>
            <div className="w-px h-8 bg-gray-200 mx-1 self-center" />
            <div className="flex items-center gap-2 px-1">
              <label className="flex items-center" title="Pencil color">
                <span className="sr-only">Pencil color</span>
                <input
                  type="color"
                  value={pencilColor}
                  onChange={(event) => onPencilColorChange(event.target.value)}
                  className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer"
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
          </>
        )}

        <div className="w-px h-8 bg-gray-200 mx-1 self-center" />

        <button
          onClick={onUndo}
          className={`
            px-3 py-2 rounded-md text-sm font-medium transition-colors
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
            px-3 py-2 rounded-md text-sm font-medium transition-colors
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
    </div>
  );
}
