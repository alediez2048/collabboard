import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';

// Validation result type used by all validators
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Tool argument types
export interface CreateStickyNoteArgs {
  text: string;
  x: number;
  y: number;
  color: string;
}

export interface CreateShapeArgs {
  type: 'rectangle' | 'circle' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface CreateFrameArgs {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateConnectorArgs {
  fromId: string;
  toId: string;
}

export interface MoveObjectArgs {
  objectId: string;
  x: number;
  y: number;
}

export interface UpdateTextArgs {
  objectId: string;
  newText: string;
}

export interface ChangeColorArgs {
  objectId: string;
  color: string;
}

// OpenAI tool definitions following the function-calling schema from the 1.3 reference repo
export const AI_TOOLS: ChatCompletionFunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'createStickyNote',
      description: 'Create a sticky note on the board at the given position with optional color and text.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text content of the sticky note.' },
          x: { type: 'number', description: 'Horizontal position on the board canvas.' },
          y: { type: 'number', description: 'Vertical position on the board canvas.' },
          color: {
            type: 'string',
            description: 'Background color as a hex string (e.g. #ffeb3b for yellow, #f87171 for red, #a3e635 for green, #60a5fa for blue, #c084fc for purple, #fb923c for orange).',
          },
        },
        required: ['text', 'x', 'y', 'color'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createShape',
      description: 'Create a geometric shape (rectangle, circle, or line) on the board.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['rectangle', 'circle', 'line'], description: 'The shape type.' },
          x: { type: 'number', description: 'Horizontal position on the canvas.' },
          y: { type: 'number', description: 'Vertical position on the canvas.' },
          width: { type: 'number', description: 'Width in pixels.' },
          height: { type: 'number', description: 'Height in pixels.' },
          color: { type: 'string', description: 'Fill or stroke color as hex (e.g. #3b82f6).' },
        },
        required: ['type', 'x', 'y', 'width', 'height', 'color'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createFrame',
      description: 'Create a labeled rectangular frame/container region on the board for grouping content.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The frame title label.' },
          x: { type: 'number', description: 'Horizontal position on the canvas.' },
          y: { type: 'number', description: 'Vertical position on the canvas.' },
          width: { type: 'number', description: 'Width in pixels.' },
          height: { type: 'number', description: 'Height in pixels.' },
        },
        required: ['title', 'x', 'y', 'width', 'height'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createConnector',
      description: 'Create a connector arrow/line between two existing board objects by their IDs.',
      parameters: {
        type: 'object',
        properties: {
          fromId: { type: 'string', description: 'The object ID where the connector starts.' },
          toId: { type: 'string', description: 'The object ID where the connector ends.' },
        },
        required: ['fromId', 'toId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'moveObject',
      description: 'Move an existing board object to a new position.',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'The unique ID of the object to move.' },
          x: { type: 'number', description: 'New horizontal position.' },
          y: { type: 'number', description: 'New vertical position.' },
        },
        required: ['objectId', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateText',
      description: 'Update the text content of a sticky note or frame title.',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'The unique ID of the object.' },
          newText: { type: 'string', description: 'The new text content.' },
        },
        required: ['objectId', 'newText'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'changeColor',
      description: 'Change the color of a sticky note or shape.',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'The unique ID of the object.' },
          color: { type: 'string', description: 'New color as hex string (e.g. #ff0000).' },
        },
        required: ['objectId', 'color'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getBoardState',
      description: 'Get the current state of the board — objects, types, positions, and text. Use this before making changes that depend on what is already on the board (e.g. moving or coloring existing objects).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

// Validators — validate parsed arguments server-side before touching Yjs

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateCreateStickyNoteArgs(args: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(args.text)) return { valid: false, error: 'text must be a non-empty string' };
  if (!isNumber(args.x)) return { valid: false, error: 'x must be a number' };
  if (!isNumber(args.y)) return { valid: false, error: 'y must be a number' };
  if (!isNonEmptyString(args.color)) return { valid: false, error: 'color must be a non-empty string' };
  return { valid: true };
}

const VALID_SHAPE_TYPES = new Set(['rectangle', 'circle', 'line']);

export function validateCreateShapeArgs(args: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(args.type) || !VALID_SHAPE_TYPES.has(args.type)) {
    return { valid: false, error: 'type must be one of: rectangle, circle, line' };
  }
  if (!isNumber(args.x)) return { valid: false, error: 'x must be a number' };
  if (!isNumber(args.y)) return { valid: false, error: 'y must be a number' };
  if (!isNumber(args.width)) return { valid: false, error: 'width must be a number' };
  if (!isNumber(args.height)) return { valid: false, error: 'height must be a number' };
  if (!isNonEmptyString(args.color)) return { valid: false, error: 'color must be a non-empty string' };
  return { valid: true };
}

export function validateCreateFrameArgs(args: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(args.title)) return { valid: false, error: 'title must be a non-empty string' };
  if (!isNumber(args.x)) return { valid: false, error: 'x must be a number' };
  if (!isNumber(args.y)) return { valid: false, error: 'y must be a number' };
  if (!isNumber(args.width)) return { valid: false, error: 'width must be a number' };
  if (!isNumber(args.height)) return { valid: false, error: 'height must be a number' };
  return { valid: true };
}

export function validateCreateConnectorArgs(args: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(args.fromId)) return { valid: false, error: 'fromId must be a non-empty string' };
  if (!isNonEmptyString(args.toId)) return { valid: false, error: 'toId must be a non-empty string' };
  if (args.fromId === args.toId) return { valid: false, error: 'fromId and toId cannot be the same object' };
  return { valid: true };
}

export function validateMoveObjectArgs(args: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(args.objectId)) return { valid: false, error: 'objectId must be a non-empty string' };
  if (!isNumber(args.x)) return { valid: false, error: 'x must be a number' };
  if (!isNumber(args.y)) return { valid: false, error: 'y must be a number' };
  return { valid: true };
}

export function validateUpdateTextArgs(args: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(args.objectId)) return { valid: false, error: 'objectId must be a non-empty string' };
  if (typeof args.newText !== 'string') return { valid: false, error: 'newText must be a string' };
  return { valid: true };
}

export function validateChangeColorArgs(args: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(args.objectId)) return { valid: false, error: 'objectId must be a non-empty string' };
  if (!isNonEmptyString(args.color)) return { valid: false, error: 'color must be a non-empty string' };
  return { valid: true };
}
