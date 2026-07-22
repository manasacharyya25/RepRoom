import { NextResponse } from "next/server";
import { isRoomId } from "@/lib/rooms";
import {
  LIVE_DISCOVERY_PAGE_SIZE,
  mapLiveSessionRow,
  type LiveSessionRow
} from "@/lib/streaming/live-sessions";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Ended live sessions with uploaded chunks — used to fill empty discovery tiles.
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
  const { data, error } = await supabase
    .from("live_sessions")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "ended")
    .gt("last_chunk_number", 0)
    .order("ended_at", { ascending: false, nullsFirst: false })
    .order("last_chunk_uploaded_at", { ascending: false })
    .limit(Math.min(40, Math.max(limit + excludeSessions.size, limit)));

  if (error) {
    console.error("[live/sessions/archives]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as LiveSessionRow[]).filter((row) => {
    if (excludeSessions.has(row.session_id)) return false;
    if (excludeUsers.has(row.user_id)) return false;
    return true;
  }).slice(0, limit);

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const profilesById = new Map<
    string,
    { display_name: string | null; avatar_url: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds);
    for (const profile of profiles ?? []) {
      profilesById.set(profile.id, {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url
      });
    }
  }

  return NextResponse.json({
    sessions: rows.map((row) =>
      mapLiveSessionRow(row, profilesById.get(row.user_id) ?? null)
    )
  });
}
