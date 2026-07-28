import { NextResponse } from "next/server";
import { isRoomId } from "@/lib/rooms";
import {
  LIVE_DISCOVERY_PAGE_SIZE,
  LIVE_SESSION_PROFILE_SELECT,
  mapLiveSessionRow,
  type ArchiveSessionRow,
  type LiveSessionProfile,
  type LiveSessionRow
} from "@/lib/streaming/live-sessions";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SessionSourceRow = LiveSessionRow | ArchiveSessionRow;

/**
 * Archived (and recently ended) sessions with uploaded chunks — fill empty discovery tiles.
 * Primary source: archive_sessions. Fallback: live_sessions still in the ended grace window
 * before the cron moves them.
 *
 * At most one session per user (newest first). Logged-in viewer is always excluded.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId")?.trim() ?? "";
  if (!isRoomId(roomId)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  const limitRaw = Number(searchParams.get("limit") ?? LIVE_DISCOVERY_PAGE_SIZE);
  const limit = Math.min(
    LIVE_DISCOVERY_PAGE_SIZE,
    Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 1)
  );

  const excludeSessions = new Set(
    (searchParams.get("exclude") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
  const excludeUsers = new Set(
    (searchParams.get("excludeUsers") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user?.id) {
    excludeUsers.add(user.id);
  }

  const fetchCap = Math.min(
    80,
    Math.max(limit * 4, limit + excludeSessions.size + excludeUsers.size)
  );

  const [{ data: archived, error: archiveError }, { data: pendingEnded, error: pendingError }] =
    await Promise.all([
      supabase
        .from("archive_sessions")
        .select("*")
        .eq("room_id", roomId)
        .gt("last_chunk_number", 0)
        .order("ended_at", { ascending: false, nullsFirst: false })
        .order("last_chunk_uploaded_at", { ascending: false })
        .limit(fetchCap),
      supabase
        .from("live_sessions")
        .select("*")
        .eq("room_id", roomId)
        .eq("status", "ended")
        .gt("last_chunk_number", 0)
        .order("ended_at", { ascending: false, nullsFirst: false })
        .order("last_chunk_uploaded_at", { ascending: false })
        .limit(fetchCap)
    ]);

  if (archiveError) {
    console.error("[live/sessions/archives] archive_sessions", archiveError);
    return NextResponse.json({ error: archiveError.message }, { status: 500 });
  }
  if (pendingError) {
    console.warn("[live/sessions/archives] live ended fallback", pendingError);
  }

  const byId = new Map<string, SessionSourceRow>();
  for (const row of [
    ...((archived ?? []) as ArchiveSessionRow[]),
    ...((pendingEnded ?? []) as LiveSessionRow[])
  ]) {
    if (excludeSessions.has(row.session_id)) continue;
    if (excludeUsers.has(row.user_id)) continue;
    if (!byId.has(row.session_id)) {
      byId.set(row.session_id, row);
    }
  }

  const sorted = [...byId.values()].sort((a, b) => {
    const aEnded = a.ended_at ?? a.last_chunk_uploaded_at;
    const bEnded = b.ended_at ?? b.last_chunk_uploaded_at;
    const byEnded = bEnded.localeCompare(aEnded);
    if (byEnded !== 0) return byEnded;
    return b.last_chunk_uploaded_at.localeCompare(a.last_chunk_uploaded_at);
  });

  // One session per user (newest already first).
  const byUser = new Map<string, SessionSourceRow>();
  for (const row of sorted) {
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, row);
    }
  }

  const rows = [...byUser.values()].slice(0, limit);

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const profilesById = new Map<string, LiveSessionProfile>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select(LIVE_SESSION_PROFILE_SELECT)
      .in("id", userIds);
    for (const profile of (profiles ?? []) as LiveSessionProfile[]) {
      if (profile.id) profilesById.set(profile.id, profile);
    }
  }

  return NextResponse.json({
    sessions: rows.map((row) =>
      mapLiveSessionRow(row, profilesById.get(row.user_id) ?? null)
    )
  });
}
