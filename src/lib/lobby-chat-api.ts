import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_IMAGES } from "@/lib/live-images";
import type {
  DbLobbyMessage,
  LobbyMessageType,
  LobbyMessageView,
  LobbySenderProfile,
  WorkoutLogMessagePayload
} from "@/lib/types/lobby-chat";
import {
  LOBBY_MESSAGE_MAX_LENGTH,
  LOBBY_MESSAGE_PAGE_SIZE
} from "@/lib/types/lobby-chat";

type LobbyMessageRow = DbLobbyMessage & {
  profiles: LobbySenderProfile | LobbySenderProfile[] | null;
};

const LOBBY_MESSAGE_SELECT = `
  id,
  sender_id,
  body,
  message_type,
  payload,
  created_at,
  profiles!lobby_messages_sender_id_fkey (
    id,
    display_name,
    username,
    avatar_url
  )
`;

function requireUser(user: { id: string } | null) {
  if (!user) throw new Error("Sign in to continue.");
  return user;
}

function normalizeProfile(
  profiles: LobbyMessageRow["profiles"]
): LobbySenderProfile | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
}

function asMessageType(value: unknown): LobbyMessageType {
  return value === "workout_log" ? "workout_log" : "text";
}

function parseWorkoutPayload(
  messageType: LobbyMessageType,
  payload: unknown
): WorkoutLogMessagePayload | null {
  if (messageType !== "workout_log" || !payload || typeof payload !== "object") {
    return null;
  }
  const raw = payload as Record<string, unknown>;
  const exerciseName =
    typeof raw.exerciseName === "string" ? raw.exerciseName.trim() : "";
  const loggedOn =
    typeof raw.loggedOn === "string" ? raw.loggedOn.trim() : "";
  if (!exerciseName || !loggedOn) return null;

  const setRaw = raw.set;
  const set =
    setRaw == null || setRaw === ""
      ? null
      : Number.isFinite(Number(setRaw))
        ? Math.round(Number(setRaw))
        : null;

  const repsRaw =
    typeof raw.reps === "string"
      ? raw.reps.trim()
      : raw.reps == null || raw.reps === ""
        ? ""
        : String(raw.reps).trim();
  const reps = repsRaw || null;

  const weight =
    typeof raw.weight === "string" && raw.weight.trim()
      ? raw.weight.trim()
      : null;

  const durationRaw = raw.durationSeconds;
  const durationSeconds =
    durationRaw == null || durationRaw === ""
      ? null
      : Number.isFinite(Number(durationRaw)) && Number(durationRaw) > 0
        ? Math.round(Number(durationRaw))
        : null;

  const planDayIndex =
    typeof raw.planDayIndex === "number" && Number.isFinite(raw.planDayIndex)
      ? raw.planDayIndex
      : null;

  if (set == null && !reps && !weight && durationSeconds == null) {
    return null;
  }

  return {
    exerciseName,
    set,
    reps,
    weight,
    durationSeconds,
    planDayIndex,
    loggedOn
  };
}

export function mapLobbyProfile(
  profile: LobbySenderProfile | null | undefined
): Pick<LobbyMessageView, "author" | "handle" | "avatar"> {
  const name = profile?.display_name?.trim() || "Athlete";
  const username = profile?.username?.trim() || null;
  const handle = username ? `@${username}` : "@athlete";
  const avatar = profile?.avatar_url?.trim() || LIVE_IMAGES.participant4;
  return { author: name, handle, avatar };
}

export function mapDbLobbyMessageToView(
  row: DbLobbyMessage | Record<string, unknown>,
  profile: LobbySenderProfile | null | undefined
): LobbyMessageView {
  const labels = mapLobbyProfile(profile);
  const raw = row as Record<string, unknown>;
  const messageType = asMessageType(raw.message_type);
  const body = typeof raw.body === "string" ? raw.body : "";
  return {
    id: String(raw.id),
    senderId: String(raw.sender_id),
    text: body,
    messageType,
    payload: parseWorkoutPayload(messageType, raw.payload ?? {}),
    createdAt: String(raw.created_at),
    ...labels
  };
}

export function formatLobbyRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) return `${Math.max(1, Math.round(diffSec / 60))}m`;
  if (diffSec < 86400) return `${Math.max(1, Math.round(diffSec / 3600))}h`;
  if (diffSec < 86400 * 7) {
    return `${Math.max(1, Math.round(diffSec / 86400))}d`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

export function formatDurationClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function buildWorkoutLogBody(payload: WorkoutLogMessagePayload): string {
  const parts = [`Logged ${payload.exerciseName}`];
  if (payload.set != null) parts.push(`Set ${payload.set}`);
  if (payload.reps) parts.push(`${payload.reps} reps`);
  if (payload.weight) parts.push(payload.weight);
  if (payload.durationSeconds != null) {
    parts.push(formatDurationClock(payload.durationSeconds));
  }
  return parts.join(" · ");
}

export async function listLobbyMessages(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<LobbyMessageView[]> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? LOBBY_MESSAGE_PAGE_SIZE),
    LOBBY_MESSAGE_PAGE_SIZE
  );

  const { data, error } = await supabase
    .from("lobby_messages")
    .select(LOBBY_MESSAGE_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = ((data ?? []) as LobbyMessageRow[])
    .map((row) =>
      mapDbLobbyMessageToView(row, normalizeProfile(row.profiles))
    )
    .reverse();

  return rows;
}

export async function sendLobbyMessage(
  supabase: SupabaseClient,
  body: string
): Promise<LobbyMessageView> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");
  if (trimmed.length > LOBBY_MESSAGE_MAX_LENGTH) {
    throw new Error("Message is too long.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  const me = requireUser(user);

  const { data, error } = await supabase
    .from("lobby_messages")
    .insert({
      sender_id: me.id,
      body: trimmed,
      message_type: "text",
      payload: {}
    })
    .select(LOBBY_MESSAGE_SELECT)
    .single();

  if (error) throw error;
  const row = data as LobbyMessageRow;
  return mapDbLobbyMessageToView(row, normalizeProfile(row.profiles));
}

export async function sendLobbyWorkoutLog(
  supabase: SupabaseClient,
  userId: string,
  payload: WorkoutLogMessagePayload
): Promise<LobbyMessageView> {
  const body = buildWorkoutLogBody(payload);
  if (body.length > LOBBY_MESSAGE_MAX_LENGTH) {
    throw new Error("Workout log message is too long.");
  }

  const { data, error } = await supabase
    .from("lobby_messages")
    .insert({
      sender_id: userId,
      body,
      message_type: "workout_log",
      payload
    })
    .select(LOBBY_MESSAGE_SELECT)
    .single();

  if (error) throw error;
  const row = data as LobbyMessageRow;
  return mapDbLobbyMessageToView(row, normalizeProfile(row.profiles));
}

export async function fetchLobbySenderProfile(
  supabase: SupabaseClient,
  senderId: string
): Promise<LobbySenderProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .eq("id", senderId)
    .maybeSingle();

  if (error) throw error;
  return (data as LobbySenderProfile | null) ?? null;
}
