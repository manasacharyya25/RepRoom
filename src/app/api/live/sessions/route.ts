import { NextResponse } from "next/server";
import {
  broadcastQuotaSeconds,
  getTier,
  metersBroadcast,
  type ProfilePlan
} from "@/lib/entitlements";
import { isRoomId } from "@/lib/rooms";
import { getUsage } from "@/lib/room-access";
import {
  decodeLiveCursor,
  encodeLiveCursor,
  LIVE_DISCOVERY_PAGE_SIZE,
  LIVE_SESSION_PROFILE_SELECT,
  LIVE_SESSION_STALE_SECONDS,
  liveSessionR2Folder,
  mapLiveSessionRow,
  type LiveSessionProfile,
  type LiveSessionRow
} from "@/lib/streaming/live-sessions";
import { createClient } from "@/lib/supabase/server";
import { subjectKeyForUser } from "@/lib/guest-identity";

export const runtime = "nodejs";

/** List currently discoverable (fresh) live sessions for a room. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId")?.trim() ?? "";
  if (!isRoomId(roomId)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  const limitRaw = Number(searchParams.get("limit") ?? LIVE_DISCOVERY_PAGE_SIZE);
  const limit = Math.min(
    LIVE_DISCOVERY_PAGE_SIZE,
    Math.max(
      1,
      Number.isFinite(limitRaw) ? Math.floor(limitRaw) : LIVE_DISCOVERY_PAGE_SIZE
    )
  );
  const cursor = decodeLiveCursor(searchParams.get("cursor"));
  const staleCutoff = new Date(
    Date.now() - LIVE_SESSION_STALE_SECONDS * 1000
  ).toISOString();

  const supabase = await createClient();
  let query = supabase
    .from("live_sessions")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "live")
    .gt("last_chunk_uploaded_at", staleCutoff)
    .order("last_chunk_uploaded_at", { ascending: false })
    .order("session_id", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.or(
      `last_chunk_uploaded_at.lt.${cursor.t},and(last_chunk_uploaded_at.eq.${cursor.t},session_id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("[live/sessions] list", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as LiveSessionRow[];
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

  const sessions = rows.map((row) =>
    mapLiveSessionRow(row, profilesById.get(row.user_id) ?? null)
  );
  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last
      ? encodeLiveCursor({
          last_chunk_uploaded_at: last.last_chunk_uploaded_at,
          session_id: last.session_id
        })
      : null;

  return NextResponse.json({
    sessions,
    nextCursor,
    staleSeconds: LIVE_SESSION_STALE_SECONDS
  });
}

/** Start (or replace) the caller's live session in a room. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    roomId?: string;
  } | null;
  const roomId = body?.roomId?.trim() ?? "";
  if (!isRoomId(roomId)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const plan = (profile?.plan as ProfilePlan | undefined) ?? "free";
  const tier = getTier({ userId: user.id, plan });

  if (metersBroadcast(tier)) {
    const quota = broadcastQuotaSeconds(tier);
    const usage = await getUsage(
      supabase,
      subjectKeyForUser(user.id),
      quota
    );
    if (usage.remainingSeconds !== null && usage.remainingSeconds <= 0) {
      return NextResponse.json(
        {
          error: "Broadcast time used up for today",
          reason: "free_time",
          remainingSeconds: 0
        },
        { status: 403 }
      );
    }
  }

  const now = new Date().toISOString();

  await supabase
    .from("live_sessions")
    .update({
      status: "ended",
      ended_at: now,
      updated_at: now
    })
    .eq("user_id", user.id)
    .eq("status", "live");

  const sessionId = crypto.randomUUID();
  const r2Folder = liveSessionR2Folder({
    roomId,
    userId: user.id,
    sessionId
  });

  const { data, error } = await supabase
    .from("live_sessions")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      room_id: roomId,
      r2_folder: r2Folder,
      status: "live",
      started_at: now,
      last_chunk_number: 0,
      last_chunk_uploaded_at: now,
      created_at: now,
      updated_at: now
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[live/sessions] insert", error);
    return NextResponse.json(
      { error: error?.message ?? "Could not start live session" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    session: mapLiveSessionRow(data as LiveSessionRow)
  });
}
