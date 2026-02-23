'use client';

export const STICKY_COLORS = [
  { value: '#ffeb3b', name: 'Yellow' },
  { value: '#f48fb1', name: 'Pink' },
  { value: '#90caf9', name: 'Blue' },
  { value: '#a5d6a7', name: 'Green' },
  { value: '#ffcc80', name: 'Orange' },
  { value: '#ce93d8', name: 'Purple' },
];

interface ColorPickerProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

export function ColorPicker({ selectedColor, onColorSelect }: ColorPickerProps) {
  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg border-2 border-black p-2 flex gap-1.5 z-50 shadow-[4px_4px_0px_#000]">
      {STICKY_COLORS.map((color) => (
        <button
          key={color.value}
          onClick={() => onColorSelect(color.value)}
          className={`
            w-8 h-8 rounded-md border-2 border-black transition-all hover:scale-110
            ${selectedColor === color.value ? 'ring-2 ring-black ring-offset-2 scale-110' : ''}
          `}
          style={{ backgroundColor: color.value }}
          title={color.name}
          aria-label={`Change color to ${color.name}`}
        />
      ))}
    </div>
  );
}
