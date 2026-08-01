export type LobbyMessageType = "text" | "workout_log";

export type WorkoutLogMessagePayload = {
  exerciseName: string;
  set: number | null;
  reps: string | null;
  weight: string | null;
  durationSeconds: number | null;
  planDayIndex: number | null;
  loggedOn: string;
};

export type DbLobbyMessage = {
  id: string;
  sender_id: string;
  body: string;
  message_type: LobbyMessageType;
  payload: Record<string, unknown>;
  created_at: string;
};

export type LobbySenderProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type LobbyMessageView = {
  id: string;
  senderId: string;
  author: string;
  handle: string;
  avatar: string;
  text: string;
  messageType: LobbyMessageType;
  payload: WorkoutLogMessagePayload | null;
  createdAt: string;
};

export const LOBBY_MESSAGE_MAX_LENGTH = 2000;
export const LOBBY_MESSAGE_PAGE_SIZE = 100;
