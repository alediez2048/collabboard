import * as Y from 'yjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;
const DEFAULT_SAVE_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 150;

function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    serviceClient = createClient(url, key);
  }
  return serviceClient;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load the latest snapshot for a board and apply it to the Y.Doc.
 * Returns true if a snapshot was found, false if the board is new.
 */
export async function loadSnapshot(boardId: string, doc: Y.Doc): Promise<boolean> {
  const startedAt = Date.now();
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('board_snapshots')
      .select('yjs_state')
      .eq('board_id', boardId)
      .single();

    if (error) {
      // PGRST116 = no rows found — this is expected for a brand new board
      if (error.code === 'PGRST116') {
        console.log(`[Persistence] No snapshot found for board ${boardId} (new board, ${Date.now() - startedAt}ms)`);
        return false;
      }
      throw error;
    }

    if (!data) {
      console.log(`[Persistence] No snapshot found for board ${boardId} (new board, ${Date.now() - startedAt}ms)`);
      return false;
    }

    // PostgREST returns BYTEA as hex (\x...) or base64 depending on pg config.
    let stateBuffer: Buffer;
    const raw = data.yjs_state;
    if (typeof raw === 'string') {
      stateBuffer = raw.startsWith('\\x')
        ? Buffer.from(raw.substring(2), 'hex')
        : Buffer.from(raw, 'base64');
    } else {
      stateBuffer = Buffer.from(raw as Buffer);
    }

    try {
      Y.applyUpdate(doc, new Uint8Array(stateBuffer));
    } catch (applyErr) {
      console.error(`[Persistence] Corrupted snapshot for ${boardId} — deleting and starting fresh:`, applyErr);
      await getServiceClient()
        .from('board_snapshots')
        .delete()
        .eq('board_id', boardId);
      return false;
    }

    console.log(`[Persistence] Snapshot loaded for board ${boardId} in ${Date.now() - startedAt}ms`);
    return true;
  } catch (err) {
    console.error(`[Persistence] Failed to load snapshot for ${boardId} after ${Date.now() - startedAt}ms:`, err);
    return false;
  }
}

/**
 * Save the current Y.Doc state as a snapshot for the board.
 * Uses upsert so board_id stays unique — only one snapshot row per board.
 */
export async function saveSnapshot(boardId: string, doc: Y.Doc): Promise<void> {
  const startedAt = Date.now();
  try {
    const supabase = getServiceClient();
    const state = Y.encodeStateAsUpdate(doc);
    // Encode as PostgreSQL hex-format BYTEA string (\xdeadbeef…) so PostgREST
    // stores the actual binary bytes rather than a JSON-serialised Buffer object.
    const hexState = '\\x' + Buffer.from(state).toString('hex');

    const { error } = await supabase
      .from('board_snapshots')
      .upsert(
        {
          board_id: boardId,
          yjs_state: hexState,
          snapshot_at: new Date().toISOString(),
        },
        { onConflict: 'board_id' },
      );

    if (error) throw error;
    console.log(
      `[Persistence] Snapshot saved for board ${boardId} (${state.length} bytes, ${Date.now() - startedAt}ms)`,
    );
  } catch (err) {
    const typedError = toError(err);
    console.error(
      `[Persistence] Failed to save snapshot for ${boardId} after ${Date.now() - startedAt}ms:`,
      typedError,
    );
    throw typedError;
  }
}

/**
 * Returns a debounced save function (at most once every intervalMs per boardId).
 * Call debouncedSave() on every Y.Doc update.
 * Call cancel() to clear any pending timer (e.g. before an immediate save on disconnect).
 */
async function saveSnapshotWithRetry(
  boardId: string,
  doc: Y.Doc,
  retries: number,
): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await saveSnapshot(boardId, doc);
      return;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      const retryDelayMs = RETRY_BASE_DELAY_MS * (attempt + 1);
      console.warn(
        `[Persistence] Save retry ${attempt + 1}/${retries} for ${boardId} in ${retryDelayMs}ms`,
      );
      await delay(retryDelayMs);
    }
  }
}

export function createDebouncedSave(
  boardId: string,
  doc: Y.Doc,
  intervalMs = 500,
): { debouncedSave: () => void; cancel: () => void; flush: () => Promise<void> } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlightSave: Promise<void> | null = null;
  let shouldSaveAfterInFlight = false;

  const runSave = async (): Promise<void> => {
    if (inFlightSave) {
      shouldSaveAfterInFlight = true;
      await inFlightSave;
      return;
    }

    inFlightSave = saveSnapshotWithRetry(boardId, doc, DEFAULT_SAVE_RETRIES)
      .catch((err) => {
        console.error(`[Persistence] Debounced save error for ${boardId}:`, err);
        throw err;
      })
      .finally(async () => {
        inFlightSave = null;
        if (shouldSaveAfterInFlight) {
          shouldSaveAfterInFlight = false;
          try {
            await runSave();
          } catch (err) {
            console.error(`[Persistence] Follow-up save error for ${boardId}:`, err);
          }
        }
      });

    await inFlightSave;
  };

  const debouncedSave = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void runSave().catch((err) => {
        console.error(`[Persistence] Debounced save execution error for ${boardId}:`, err);
      });
    }, intervalMs);
  };

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    await runSave();
  };

  const cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    shouldSaveAfterInFlight = false;
  };

  return { debouncedSave, cancel, flush };
}
