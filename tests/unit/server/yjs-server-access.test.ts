import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/auth', () => ({
  verifySupabaseToken: vi.fn(async () => ({ userId: 'user-1', email: 'u@example.com' })),
}));
vi.mock('../../../server/src/board-access', () => ({
  canAccessBoard: vi.fn(),
}));
vi.mock('../../../server/src/persistence', () => ({
  loadSnapshot: vi.fn(async () => undefined),
  createDebouncedSave: vi.fn(() => ({ debouncedSave: vi.fn(), flush: vi.fn(async () => undefined), cancel: vi.fn() })),
}));

import { canAccessBoard } from '../../../server/src/board-access';
import { setupYjsServer } from '../../../server/src/yjs-server';

const BOARD = 'b0a2d1c4-1111-4111-8111-111111111111';

function fakeSocket() {
  const ws = new EventEmitter() as EventEmitter & { close: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; readyState: number };
  ws.close = vi.fn();
  ws.send = vi.fn();
  ws.readyState = 1;
  return ws;
}

async function connect(wss: EventEmitter, ws: ReturnType<typeof fakeSocket>) {
  wss.emit('connection', ws, { url: `/yjs/${BOARD}?token=abc`, headers: { host: 'localhost' } });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Yjs server board access', () => {
  beforeEach(() => vi.mocked(canAccessBoard).mockReset());

  it('closes the socket for a signed-in user without access to the board', async () => {
    vi.mocked(canAccessBoard).mockResolvedValue(false);
    const wss = new EventEmitter();
    setupYjsServer(wss as never);
    const ws = fakeSocket();
    await connect(wss, ws);
    expect(canAccessBoard).toHaveBeenCalledWith('user-1', BOARD);
    expect(ws.close).toHaveBeenCalledWith(1008, 'Access denied');
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('syncs the board for an owner or member', async () => {
    vi.mocked(canAccessBoard).mockResolvedValue(true);
    const wss = new EventEmitter();
    setupYjsServer(wss as never);
    const ws = fakeSocket();
    await connect(wss, ws);
    expect(ws.close).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalled();
  });
});
