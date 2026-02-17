import * as Y from 'yjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;

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

/**
 * Load the latest snapshot for a board and apply it to the Y.Doc.
 * Returns true if a snapshot was found, false if the board is new.
 */
export async function loadSnapshot(boardId: string, doc: Y.Doc): Promise<boolean> {
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
        console.log(`[Persistence] No snapshot found for board ${boardId} (new board)`);
        return false;
      }
      throw error;
    }

    if (!data) {
      console.log(`[Persistence] No snapshot found for board ${boardId} (new board)`);
      return false;
    }

    // yjs_state comes back as a base64 string via Supabase REST API (PostgREST)
    const stateBuffer =
      typeof data.yjs_state === 'string'
        ? Buffer.from(data.yjs_state, 'base64')
        : Buffer.from(data.yjs_state as Buffer);

    Y.applyUpdate(doc, new Uint8Array(stateBuffer));
    console.log(`[Persistence] Snapshot loaded for board ${boardId}`);
    return true;
  } catch (err) {
    console.error(`[Persistence] Failed to load snapshot for ${boardId}:`, err);
    return false;
  }
}

/**
 * Save the current Y.Doc state as a snapshot for the board.
 * Uses upsert so board_id stays unique — only one snapshot row per board.
 */
export async function saveSnapshot(boardId: string, doc: Y.Doc): Promise<void> {
  try {
    const supabase = getServiceClient();
    const state = Y.encodeStateAsUpdate(doc);

    const { error } = await supabase
      .from('board_snapshots')
      .upsert(
        {
          board_id: boardId,
          yjs_state: Buffer.from(state),
          snapshot_at: new Date().toISOString(),
        },
        { onConflict: 'board_id' },
      );

    if (error) throw error;
    console.log(`[Persistence] Snapshot saved for board ${boardId} (${state.length} bytes)`);
  } catch (err) {
    console.error(`[Persistence] Failed to save snapshot for ${boardId}:`, err);
  }
}

/**
 * Returns a debounced save function (at most once every intervalMs per boardId).
 * Call debouncedSave() on every Y.Doc update.
 * Call cancel() to clear any pending timer (e.g. before an immediate save on disconnect).
 */
export function createDebouncedSave(
  boardId: string,
  doc: Y.Doc,
  intervalMs = 500,
): { debouncedSave: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debouncedSave = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      saveSnapshot(boardId, doc).catch((err) => {
        console.error(`[Persistence] Debounced save error for ${boardId}:`, err);
      });
    }, intervalMs);
  };

  const cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return { debouncedSave, cancel };
}
