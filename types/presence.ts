export interface AwarenessUser {
  userId: string;
  userName: string;
  color: string;
  isOnline: boolean;
}

export interface AwarenessState {
  user?: AwarenessUser;
}
