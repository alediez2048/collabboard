import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveViewport,
  loadViewport,
  defaultViewport,
  type ViewportState,
} from '@/lib/utils/viewport-storage';

// Lightweight localStorage stub
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};

vi.stubGlobal('localStorage', localStorageMock);

beforeEach(() => {
  localStorageMock.clear();
});

describe('defaultViewport', () => {
  it('returns zoom 1 and pan at origin', () => {
    expect(defaultViewport.zoom).toBe(1);
    expect(defaultViewport.pan).toEqual({ x: 0, y: 0 });
  });
});

describe('saveViewport / loadViewport roundtrip', () => {
  it('saves and restores zoom and pan correctly', () => {
    const state: ViewportState = { zoom: 2.5, pan: { x: -300, y: 120 } };
    saveViewport('board-abc', state);
    const loaded = loadViewport('board-abc');
    expect(loaded.zoom).toBeCloseTo(2.5);
    expect(loaded.pan.x).toBeCloseTo(-300);
    expect(loaded.pan.y).toBeCloseTo(120);
  });

  it('uses a board-scoped key so different boards are independent', () => {
    saveViewport('board-1', { zoom: 2, pan: { x: 100, y: 0 } });
    saveViewport('board-2', { zoom: 0.5, pan: { x: -50, y: -50 } });
    expect(loadViewport('board-1').zoom).toBeCloseTo(2);
    expect(loadViewport('board-2').zoom).toBeCloseTo(0.5);
  });
});

describe('loadViewport — fallback behaviour', () => {
  it('returns default when nothing is stored', () => {
    const result = loadViewport('board-missing');
    expect(result).toEqual(defaultViewport);
  });

  it('returns default when stored JSON is malformed', () => {
    localStorageMock.setItem('canvasViewport:board-bad', '{not valid json}');
    const result = loadViewport('board-bad');
    expect(result).toEqual(defaultViewport);
  });

  it('returns default when zoom field is missing', () => {
    localStorageMock.setItem(
      'canvasViewport:board-x',
      JSON.stringify({ pan: { x: 0, y: 0 } }),
    );
    expect(loadViewport('board-x')).toEqual(defaultViewport);
  });

  it('returns default when pan field is missing', () => {
    localStorageMock.setItem(
      'canvasViewport:board-x',
      JSON.stringify({ zoom: 1.5 }),
    );
    expect(loadViewport('board-x')).toEqual(defaultViewport);
  });

  it('returns default when pan is missing x or y', () => {
    localStorageMock.setItem(
      'canvasViewport:board-x',
      JSON.stringify({ zoom: 1.5, pan: { x: 100 } }),
    );
    expect(loadViewport('board-x')).toEqual(defaultViewport);
  });
});

describe('loadViewport — zoom clamping', () => {
  it('clamps zoom below 0.01 to 0.01', () => {
    saveViewport('board-clamp', { zoom: 0.001, pan: { x: 0, y: 0 } });
    expect(loadViewport('board-clamp').zoom).toBe(0.01);
  });

  it('clamps zoom above 10 to 10', () => {
    saveViewport('board-clamp', { zoom: 99, pan: { x: 0, y: 0 } });
    expect(loadViewport('board-clamp').zoom).toBe(10);
  });

  it('does not clamp zoom within valid range', () => {
    saveViewport('board-clamp', { zoom: 3.7, pan: { x: 0, y: 0 } });
    expect(loadViewport('board-clamp').zoom).toBeCloseTo(3.7);
  });
});
