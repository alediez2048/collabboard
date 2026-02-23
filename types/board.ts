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

export type DashboardBoardThumbnailStatus = 'snapshot' | 'empty' | 'placeholder' | 'error';

export interface DashboardBoardThumbnailShape {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  borderRadius: number;
}

export interface DashboardBoardThumbnail {
  status: DashboardBoardThumbnailStatus;
  objectCount: number;
  snapshotAt: string | null;
  shapes: DashboardBoardThumbnailShape[];
}

export interface DashboardBoard extends Board {
  is_starred: boolean;
  last_opened_at: string | null;
  thumbnail?: DashboardBoardThumbnail;
}
