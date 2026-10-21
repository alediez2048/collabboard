import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Who may join a board's realtime rooms: its owner, or a user who joined it
 * by link (a row in board_members). Checked with the service-role client,
 * so it does not depend on the caller's row-level security context.
 */

type QueryClient = Pick<SupabaseClient, 'from'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function canAccessBoard(
  userId: string,
  boardId: string,
  client: QueryClient = getServiceClient(),
): Promise<boolean> {
  if (!UUID_PATTERN.test(boardId)) return false;

  try {
    const { data: board, error: boardError } = await client
      .from('boards')
      .select('id, created_by')
      .eq('id', boardId)
      .maybeSingle();

    if (boardError || !board) return false;
    if (board.created_by === userId) return true;

    const { data: membership, error: memberError } = await client
      .from('board_members')
      .select('user_id')
      .eq('board_id', boardId)
      .eq('user_id', userId)
      .maybeSingle();

    return !memberError && Boolean(membership);
  } catch (error) {
    console.error('[Access] Board access check failed:', error);
    return false;
  }
}
