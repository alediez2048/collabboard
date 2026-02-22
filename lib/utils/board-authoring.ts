export type BoardTool =
  | 'select'
  | 'hand'
  | 'pencil'
  | 'eraser'
  | 'sticky'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'connector'
  | 'frame'
  | 'text';

export interface BoardShortcutLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function canPanStage(tool: BoardTool): boolean {
  return tool === 'hand';
}

export function shouldEnableObjectInteractions(tool: BoardTool): boolean {
  return tool !== 'hand' && tool !== 'eraser' && tool !== 'pencil';
}

export function shouldStartMarqueeSelection(
  tool: BoardTool,
  isStageTarget: boolean,
): boolean {
  return tool === 'select' && isStageTarget;
}

export function getStageCursor(tool: BoardTool, isPanning: boolean): string {
  if (tool === 'hand') {
    return isPanning ? 'grabbing' : 'grab';
  }

  if (tool === 'connector') {
    return 'cell';
  }

  if (tool === 'text') {
    return 'text';
  }

  if (
    tool === 'rectangle' ||
    tool === 'circle' ||
    tool === 'line' ||
    tool === 'frame' ||
    tool === 'pencil' ||
    tool === 'eraser'
  ) {
    return 'crosshair';
  }

  return 'default';
}

function isShortcutModifierPressed(event: BoardShortcutLike): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey;
}

function isZShortcut(event: BoardShortcutLike): boolean {
  const key = (event.key ?? '').toLowerCase();
  return key === 'z' || event.code === 'KeyZ';
}

export function isUndoShortcut(event: BoardShortcutLike): boolean {
  return isShortcutModifierPressed(event) && !event.shiftKey && isZShortcut(event);
}

export function isRedoShortcut(event: BoardShortcutLike): boolean {
  return isShortcutModifierPressed(event) && event.shiftKey && isZShortcut(event);
}
