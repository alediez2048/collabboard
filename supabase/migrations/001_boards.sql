-- ============================================================
-- Boards and board membership. Run this first, before
-- 002_board_snapshots.sql and 003_board_user_state.sql.
-- Run in Supabase Dashboard > SQL Editor (safe to re-run).
--
-- Access model: the creator owns a board. Anyone signed in who has
-- the board's link can join it as an editor (POST /api/boards/[id]/join
-- inserts their own membership row). Row-level security hides every
-- board a user neither owns nor has joined, which the API routes rely on.
-- ============================================================

CREATE TABLE IF NOT EXISTS boards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT 'Untitled Board' CHECK (char_length(name) BETWEEN 1 AND 200),
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS boards_created_by_idx ON boards (created_by);
CREATE INDEX IF NOT EXISTS boards_created_at_idx ON boards (created_at DESC);

CREATE TABLE IF NOT EXISTS board_members (
  board_id   UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  joined_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id)
);

CREATE INDEX IF NOT EXISTS board_members_user_idx ON board_members (user_id);

-- Membership check used by the boards policies. SECURITY DEFINER avoids
-- the policy on board_members recursing into the policy on boards.
CREATE OR REPLACE FUNCTION is_board_member(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_members
    WHERE board_id = p_board_id AND user_id = auth.uid()
  );
$$;

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boards_select_owner_or_member" ON boards;
DROP POLICY IF EXISTS "boards_insert_own" ON boards;
DROP POLICY IF EXISTS "boards_update_owner" ON boards;
DROP POLICY IF EXISTS "boards_delete_owner" ON boards;

CREATE POLICY "boards_select_owner_or_member"
  ON boards FOR SELECT
  USING (created_by = auth.uid() OR is_board_member(id));

CREATE POLICY "boards_insert_own"
  ON boards FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "boards_update_owner"
  ON boards FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "boards_delete_owner"
  ON boards FOR DELETE
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "members_select_self_or_owner" ON board_members;
DROP POLICY IF EXISTS "members_join_self" ON board_members;
DROP POLICY IF EXISTS "members_leave_self_or_owner" ON board_members;

-- You see your own memberships; an owner sees everyone on their board.
CREATE POLICY "members_select_self_or_owner"
  ON board_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM boards b WHERE b.id = board_id AND b.created_by = auth.uid())
  );

-- Joining by link: a user may add only themselves, and only as an editor.
CREATE POLICY "members_join_self"
  ON board_members FOR INSERT
  WITH CHECK (user_id = auth.uid() AND role = 'editor');

CREATE POLICY "members_leave_self_or_owner"
  ON board_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM boards b WHERE b.id = board_id AND b.created_by = auth.uid())
  );
