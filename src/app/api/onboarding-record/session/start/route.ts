import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  onboardingR2Folder,
  readOnboardingSession,
  remainingSeconds,
  type OnboardingRecorderRow
} from "@/lib/onboarding-recorder";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Onboarding recorder is not configured" },
      { status: 503 }
    );
  }

  const session = await readOnboardingSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    username?: string;
  } | null;
  const username = String(body?.username ?? session.username)
    .trim()
    .toLowerCase();

  if (username !== session.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("onboarding_recorders")
    .select("id, username, max_seconds, seconds_used, active")
    .eq("id", session.recorderId)
    .maybeSingle();

  if (error || !row || !row.active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recorder = row as Omit<OnboardingRecorderRow, "password_hash">;
  const remaining = remainingSeconds(recorder);
  if (remaining <= 0) {
    return NextResponse.json(
      {
        error: "Recording time limit reached",
        reason: "time_limit",
        remainingSeconds: 0,
        exhausted: true
      },
      { status: 403 }
    );
  }

  // End any prior live sessions for this recorder.
  await admin
    .from("onboarding_recorder_sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString()
    })
    .eq("recorder_id", recorder.id)
    .eq("status", "live");

  const sessionId = randomUUID();
  const { error: insertError } = await admin
    .from("onboarding_recorder_sessions")
    .insert({
      session_id: sessionId,
      recorder_id: recorder.id,
      status: "live"
    });

  if (insertError) {
    console.error("[onboarding-record/session/start]", insertError);
    return NextResponse.json(
      { error: "Could not start session" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    sessionId,
    recorderId: recorder.id,
    r2Folder: onboardingR2Folder(recorder.id, sessionId),
    remainingSeconds: remaining,
    maxSeconds: recorder.max_seconds,
    secondsUsed: recorder.seconds_used
  });
}
