export interface Board {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface BoardUserState {
  board_id: string;
  user_id: string;
  is_starred: boolean;
  last_opened_at: string | null;
  updated_at: string;
}

export interface DashboardBoard extends Board {
  is_starred: boolean;
  last_opened_at: string | null;
}
