import { NextResponse } from "next/server";
import { isRoomId } from "@/lib/rooms";
import {
  LIVE_SESSION_PROFILE_SELECT,
  LIVE_SESSION_STALE_SECONDS,
  mapLiveSessionRow,
  type LiveSessionProfile,
  type LiveSessionRow
} from "@/lib/streaming/live-sessions";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Return one fresh live session not in the exclude list (tile replacement). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId")?.trim() ?? "";
  if (!isRoomId(roomId)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  const exclude = (searchParams.get("exclude") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const staleCutoff = new Date(
    Date.now() - LIVE_SESSION_STALE_SECONDS * 1000
  ).toISOString();

  const supabase = await createClient();
  const excludeSet = new Set(exclude);
  const { data, error } = await supabase
    .from("live_sessions")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "live")
    .gt("last_chunk_uploaded_at", staleCutoff)
    .order("last_chunk_uploaded_at", { ascending: false })
    .order("session_id", { ascending: false })
    .limit(Math.min(40, Math.max(8, exclude.length + 5)));

  if (error) {
    console.error("[live/sessions/replace]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row =
    ((data ?? []) as LiveSessionRow[]).find(
      (candidate) => !excludeSet.has(candidate.session_id)
    ) ?? null;
  if (!row) {
    return NextResponse.json({
      session: null,
      staleSeconds: LIVE_SESSION_STALE_SECONDS
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(LIVE_SESSION_PROFILE_SELECT)
    .eq("id", row.user_id)
    .maybeSingle();

  return NextResponse.json({
    session: mapLiveSessionRow(
      row,
      (profile as LiveSessionProfile | null) ?? null
    ),
    staleSeconds: LIVE_SESSION_STALE_SECONDS
  });
}
