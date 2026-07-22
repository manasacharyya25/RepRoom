import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Mark a live session as ended (row kept for archival). */
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
    sessionId?: string;
  } | null;
  const sessionId = body?.sessionId?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("live_sessions")
    .update({
      status: "ended",
      ended_at: now,
      updated_at: now
    })
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .eq("status", "live")
    .select("session_id")
    .maybeSingle();

  if (error) {
    console.error("[live/sessions/end]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ended: Boolean(data) });
}
