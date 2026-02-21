-- ============================================================
-- TICKET-18: Board discovery metadata per user
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS board_user_state (
  board_id       UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_starred     BOOLEAN NOT NULL DEFAULT FALSE,
  last_opened_at TIMESTAMP WITH TIME ZONE,
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id)
);

CREATE INDEX IF NOT EXISTS board_user_state_user_last_opened_idx
  ON board_user_state (user_id, last_opened_at DESC)
  WHERE last_opened_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS board_user_state_user_starred_idx
  ON board_user_state (user_id, is_starred)
  WHERE is_starred = TRUE;

ALTER TABLE board_user_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bus_select_own" ON board_user_state;
DROP POLICY IF EXISTS "bus_insert_own" ON board_user_state;
DROP POLICY IF EXISTS "bus_update_own" ON board_user_state;
DROP POLICY IF EXISTS "bus_delete_own" ON board_user_state;

CREATE POLICY "bus_select_own"
  ON board_user_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "bus_insert_own"
  ON board_user_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bus_update_own"
  ON board_user_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bus_delete_own"
  ON board_user_state FOR DELETE
  USING (auth.uid() = user_id);
