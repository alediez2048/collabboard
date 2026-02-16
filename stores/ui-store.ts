import { create } from 'zustand';

interface UIState {
  selectedTool: 'select' | 'sticky' | 'rectangle' | 'circle' | 'line' | 'text';
  zoom: number;
  setSelectedTool: (tool: UIState['selectedTool']) => void;
  setZoom: (zoom: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedTool: 'select',
  zoom: 1,
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setZoom: (zoom) => set({ zoom }),
}));
