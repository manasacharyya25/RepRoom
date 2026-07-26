import { NextResponse } from "next/server";
import { readOnboardingSession } from "@/lib/onboarding-recorder";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Onboarding recorder is not configured" },
      { status: 503 }
    );
  }

  const auth = await readOnboardingSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    sessionId?: string;
  } | null;
  const sessionId = String(body?.sessionId ?? "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("onboarding_recorder_sessions")
    .update({
      status: "ended",
      ended_at: now
    })
    .eq("session_id", sessionId)
    .eq("recorder_id", auth.recorderId)
    .eq("status", "live");

  if (error) {
    console.error("[onboarding-record/session/end]", error);
    return NextResponse.json(
      { error: "Could not end session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, sessionId });
}
