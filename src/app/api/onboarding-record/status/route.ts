import { NextResponse } from "next/server";
import {
  isValidOnboardingUsername,
  readOnboardingSession,
  remainingSeconds,
  type OnboardingRecorderRow
} from "@/lib/onboarding-recorder";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Onboarding recorder is not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const username = String(searchParams.get("username") ?? "")
    .trim()
    .toLowerCase();

  if (!isValidOnboardingUsername(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const session = await readOnboardingSession();
  const authenticated =
    Boolean(session) && session!.username === username;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("onboarding_recorders")
    .select("id, username, max_seconds, seconds_used, active")
    .ilike("username", username)
    .maybeSingle();

  if (error) {
    console.error("[onboarding-record/status]", error);
    return NextResponse.json({ error: "Could not load status" }, { status: 500 });
  }

  if (!data || !data.active) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = data as Omit<OnboardingRecorderRow, "password_hash">;
  const remaining = remainingSeconds(row);

  return NextResponse.json({
    ok: true,
    username: row.username.toLowerCase(),
    exists: true,
    authenticated,
    recorderId: authenticated ? row.id : null,
    maxSeconds: authenticated ? row.max_seconds : null,
    secondsUsed: authenticated ? row.seconds_used : null,
    remainingSeconds: authenticated ? remaining : null,
    exhausted: authenticated ? remaining <= 0 : null
  });
}
