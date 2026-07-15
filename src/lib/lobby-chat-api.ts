import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_IMAGES } from "@/lib/live-images";
import type {
  DbLobbyMessage,
  LobbyMessageView,
  LobbySenderProfile
} from "@/lib/types/lobby-chat";
import {
  LOBBY_MESSAGE_MAX_LENGTH,
  LOBBY_MESSAGE_PAGE_SIZE
} from "@/lib/types/lobby-chat";

type LobbyMessageRow = DbLobbyMessage & {
  profiles: LobbySenderProfile | LobbySenderProfile[] | null;
};

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
  row: DbLobbyMessage,
  profile: LobbySenderProfile | null | undefined
): LobbyMessageView {
  const labels = mapLobbyProfile(profile);
  return {
    id: row.id,
    senderId: row.sender_id,
    text: row.body,
    createdAt: row.created_at,
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
    .select(
      `
      id,
      sender_id,
      body,
      created_at,
      profiles!lobby_messages_sender_id_fkey (
        id,
        display_name,
        username,
        avatar_url
      )
    `
    )
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
      body: trimmed
    })
    .select(
      `
      id,
      sender_id,
      body,
      created_at,
      profiles!lobby_messages_sender_id_fkey (
        id,
        display_name,
        username,
        avatar_url
      )
    `
    )
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
