import { describe, it, expect } from 'vitest';
import {
  AI_TOOLS,
  validateCreateStickyNoteArgs,
  validateCreateShapeArgs,
  validateCreateFrameArgs,
  validateCreateConnectorArgs,
  validateMoveObjectArgs,
  validateUpdateTextArgs,
  validateChangeColorArgs,
} from '@/lib/ai-agent/tools';

describe('AI Tool Definitions', () => {
  it('exports all required tool names', () => {
    const names = AI_TOOLS.map((t) => t.function.name);
    expect(names).toContain('createStickyNote');
    expect(names).toContain('createShape');
    expect(names).toContain('createFrame');
    expect(names).toContain('createConnector');
    expect(names).toContain('moveObject');
    expect(names).toContain('updateText');
    expect(names).toContain('changeColor');
    expect(names).toContain('getBoardState');
  });

  it('each tool has type function, name, description, and parameters', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeTruthy();
      expect((tool.function.description ?? '').length).toBeGreaterThan(10);
      expect(tool.function.parameters).toBeTruthy();
    }
  });

  it('has at least 8 tools', () => {
    expect(AI_TOOLS.length).toBeGreaterThanOrEqual(8);
  });
});

describe('validateCreateStickyNoteArgs', () => {
  it('accepts valid args', () => {
    const result = validateCreateStickyNoteArgs({ text: 'Hello', x: 100, y: 200, color: '#ffeb3b' });
    expect(result.valid).toBe(true);
  });

  it('rejects missing text', () => {
    const result = validateCreateStickyNoteArgs({ x: 100, y: 200, color: '#ffeb3b' });
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects non-numeric x', () => {
    const result = validateCreateStickyNoteArgs({ text: 'Hi', x: 'bad', y: 200, color: '#fff' });
    expect(result.valid).toBe(false);
  });

  it('rejects non-numeric y', () => {
    const result = validateCreateStickyNoteArgs({ text: 'Hi', x: 100, y: null, color: '#fff' });
    expect(result.valid).toBe(false);
  });
});

describe('validateCreateShapeArgs', () => {
  it('accepts valid rectangle', () => {
    const result = validateCreateShapeArgs({ type: 'rectangle', x: 0, y: 0, width: 100, height: 80, color: '#3b82f6' });
    expect(result.valid).toBe(true);
  });

  it('accepts valid circle', () => {
    const result = validateCreateShapeArgs({ type: 'circle', x: 0, y: 0, width: 100, height: 100, color: '#f87171' });
    expect(result.valid).toBe(true);
  });

  it('accepts valid line', () => {
    const result = validateCreateShapeArgs({ type: 'line', x: 0, y: 0, width: 200, height: 1, color: '#333' });
    expect(result.valid).toBe(true);
  });

  it('rejects unknown shape type', () => {
    const result = validateCreateShapeArgs({ type: 'hexagon', x: 0, y: 0, width: 100, height: 80, color: '#fff' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing dimensions', () => {
    const result = validateCreateShapeArgs({ type: 'rectangle', x: 0, y: 0 });
    expect(result.valid).toBe(false);
  });
});

describe('validateCreateFrameArgs', () => {
  it('accepts valid frame args', () => {
    const result = validateCreateFrameArgs({ title: 'Sprint Board', x: 0, y: 0, width: 400, height: 300 });
    expect(result.valid).toBe(true);
  });

  it('rejects missing title', () => {
    const result = validateCreateFrameArgs({ x: 0, y: 0, width: 400, height: 300 });
    expect(result.valid).toBe(false);
  });
});

describe('validateCreateConnectorArgs', () => {
  it('accepts valid connector args', () => {
    const result = validateCreateConnectorArgs({ fromId: 'obj-a', toId: 'obj-b' });
    expect(result.valid).toBe(true);
  });

  it('rejects self-connector (fromId equals toId)', () => {
    const result = validateCreateConnectorArgs({ fromId: 'same-id', toId: 'same-id' });
    expect(result.valid).toBe(false);
  });

  it('rejects empty fromId', () => {
    const result = validateCreateConnectorArgs({ fromId: '', toId: 'obj-b' });
    expect(result.valid).toBe(false);
  });

  it('rejects empty toId', () => {
    const result = validateCreateConnectorArgs({ fromId: 'obj-a', toId: '' });
    expect(result.valid).toBe(false);
  });
});

describe('validateMoveObjectArgs', () => {
  it('accepts valid args', () => {
    const result = validateMoveObjectArgs({ objectId: 'abc-123', x: 50, y: 75 });
    expect(result.valid).toBe(true);
  });

  it('rejects empty objectId', () => {
    const result = validateMoveObjectArgs({ objectId: '', x: 50, y: 75 });
    expect(result.valid).toBe(false);
  });

  it('rejects missing coordinates', () => {
    const result = validateMoveObjectArgs({ objectId: 'abc' });
    expect(result.valid).toBe(false);
  });
});

describe('validateUpdateTextArgs', () => {
  it('accepts valid args', () => {
    const result = validateUpdateTextArgs({ objectId: 'abc', newText: 'Updated label' });
    expect(result.valid).toBe(true);
  });

  it('accepts empty string as valid new text (clearing text)', () => {
    const result = validateUpdateTextArgs({ objectId: 'abc', newText: '' });
    expect(result.valid).toBe(true);
  });

  it('rejects missing objectId', () => {
    const result = validateUpdateTextArgs({ newText: 'Text' });
    expect(result.valid).toBe(false);
  });
});

describe('validateChangeColorArgs', () => {
  it('accepts valid hex color', () => {
    const result = validateChangeColorArgs({ objectId: 'abc', color: '#ff0000' });
    expect(result.valid).toBe(true);
  });

  it('rejects empty color', () => {
    const result = validateChangeColorArgs({ objectId: 'abc', color: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing objectId', () => {
    const result = validateChangeColorArgs({ color: '#fff' });
    expect(result.valid).toBe(false);
  });
});
