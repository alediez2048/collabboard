-- TICKET-07: Board state snapshots
-- Run in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS board_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id     UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  yjs_state    BYTEA NOT NULL,
  snapshot_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT board_snapshots_board_id_unique UNIQUE (board_id)
);

-- Service role bypasses RLS — no policies needed for server-side writes.
-- Optionally enable RLS and allow only service_role:
ALTER TABLE board_snapshots ENABLE ROW LEVEL SECURITY;

-- Boards owners can read their board's snapshot (for debugging)
CREATE POLICY "snapshot_select_owner"
  ON board_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_id
        AND boards.created_by = auth.uid()
    )
  );
