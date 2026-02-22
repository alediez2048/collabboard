import { describe, expect, it } from 'vitest';
import {
  canPanStage,
  getStageCursor,
  isRedoShortcut,
  isUndoShortcut,
  shouldStartMarqueeSelection,
  shouldEnableObjectInteractions,
  type BoardShortcutLike,
} from '@/lib/utils/board-authoring';

function makeShortcutEvent(overrides: Partial<BoardShortcutLike>): BoardShortcutLike {
  return {
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  };
}

describe('board authoring controls', () => {
  it('limits stage panning to hand mode', () => {
    expect(canPanStage('hand')).toBe(true);
    expect(canPanStage('select')).toBe(false);
    expect(canPanStage('sticky')).toBe(false);
  });

  it('disables object interactions while in hand mode', () => {
    expect(shouldEnableObjectInteractions('hand')).toBe(false);
    expect(shouldEnableObjectInteractions('pencil')).toBe(false);
    expect(shouldEnableObjectInteractions('eraser')).toBe(false);
    expect(shouldEnableObjectInteractions('select')).toBe(true);
    expect(shouldEnableObjectInteractions('text')).toBe(true);
  });

  it('uses the expected stage cursor per tool mode', () => {
    expect(getStageCursor('rectangle', false)).toBe('crosshair');
    expect(getStageCursor('pencil', false)).toBe('crosshair');
    expect(getStageCursor('eraser', false)).toBe('crosshair');
    expect(getStageCursor('connector', false)).toBe('cell');
    expect(getStageCursor('text', false)).toBe('text');
    expect(getStageCursor('hand', false)).toBe('grab');
    expect(getStageCursor('hand', true)).toBe('grabbing');
    expect(getStageCursor('select', false)).toBe('default');
  });

  it('starts marquee selection when dragging empty canvas in select mode', () => {
    expect(shouldStartMarqueeSelection('select', true)).toBe(true);
    expect(shouldStartMarqueeSelection('hand', true)).toBe(false);
    expect(shouldStartMarqueeSelection('rectangle', true)).toBe(false);
    expect(shouldStartMarqueeSelection('select', false)).toBe(false);
  });

  it('detects undo keyboard shortcuts for cmd/ctrl + z', () => {
    expect(
      isUndoShortcut(makeShortcutEvent({ key: 'z', metaKey: true })),
    ).toBe(true);
    expect(
      isUndoShortcut(makeShortcutEvent({ key: 'Z', ctrlKey: true })),
    ).toBe(true);
    expect(
      isUndoShortcut(makeShortcutEvent({ code: 'KeyZ', ctrlKey: true })),
    ).toBe(true);
    expect(
      isUndoShortcut(makeShortcutEvent({ key: 'z', ctrlKey: true, shiftKey: true })),
    ).toBe(false);
    expect(
      isUndoShortcut(makeShortcutEvent({ key: 'z', ctrlKey: true, altKey: true })),
    ).toBe(false);
  });

  it('detects redo keyboard shortcuts for shift + cmd/ctrl + z', () => {
    expect(
      isRedoShortcut(makeShortcutEvent({ key: 'z', metaKey: true, shiftKey: true })),
    ).toBe(true);
    expect(
      isRedoShortcut(makeShortcutEvent({ key: 'Z', ctrlKey: true, shiftKey: true })),
    ).toBe(true);
    expect(
      isRedoShortcut(makeShortcutEvent({ code: 'KeyZ', ctrlKey: true, shiftKey: true })),
    ).toBe(true);
    expect(
      isRedoShortcut(makeShortcutEvent({ key: 'z', ctrlKey: true })),
    ).toBe(false);
    expect(
      isRedoShortcut(makeShortcutEvent({ key: 'y', ctrlKey: true })),
    ).toBe(false);
  });
});
