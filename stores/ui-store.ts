import { create } from 'zustand';
import type { BoardTool } from '@/lib/utils/board-authoring';

interface UIState {
  selectedTool: BoardTool;
  zoom: number;
  pan: { x: number; y: number };
  setSelectedTool: (tool: UIState['selectedTool']) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setViewport: (viewport: { zoom: number; pan: { x: number; y: number } }) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedTool: 'select',
  zoom: 1,
  pan: { x: 0, y: 0 },
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setViewport: (viewport) => set({ zoom: viewport.zoom, pan: viewport.pan }),
}));
