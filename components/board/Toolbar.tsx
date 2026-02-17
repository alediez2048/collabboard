'use client';

import { useUIStore } from '@/stores/ui-store';

export function Toolbar() {
  const { selectedTool, setSelectedTool } = useUIStore();

  const tools = [
    { id: 'select', label: 'Select', icon: '⌃' },
    { id: 'sticky', label: 'Sticky Note', icon: '📝' },
    { id: 'rectangle', label: 'Rectangle', icon: '▭' },
    { id: 'circle', label: 'Circle', icon: '○' },
    { id: 'line', label: 'Line', icon: '╱' },
    { id: 'text', label: 'Text', icon: 'T' },
  ] as const;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id as typeof selectedTool)}
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
      </div>
    </div>
  );
}
