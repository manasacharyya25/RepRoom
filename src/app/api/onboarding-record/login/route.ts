import { NextResponse } from "next/server";
import {
  encodeOnboardingSessionCookie,
  isValidOnboardingUsername,
  onboardingSessionCookieHeader,
  remainingSeconds,
  verifyOnboardingPassword,
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

  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;

  const username = String(body?.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");

  if (!isValidOnboardingUsername(username) || !password) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("onboarding_recorders")
    .select("id, username, password_hash, max_seconds, seconds_used, active")
    .ilike("username", username)
    .maybeSingle();

  if (error) {
    console.error("[onboarding-record/login]", error);
    return NextResponse.json({ error: "Could not sign in" }, { status: 500 });
  }

  const row = data as OnboardingRecorderRow | null;
  if (!row || !row.active) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const ok = await verifyOnboardingPassword(password, row.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const token = encodeOnboardingSessionCookie({
    recorderId: row.id,
    username: row.username.toLowerCase()
  });

  const remaining = remainingSeconds(row);
  const response = NextResponse.json({
    ok: true,
    username: row.username.toLowerCase(),
    recorderId: row.id,
    maxSeconds: row.max_seconds,
    secondsUsed: row.seconds_used,
    remainingSeconds: remaining,
    exhausted: remaining <= 0
  });
  response.headers.append("Set-Cookie", onboardingSessionCookieHeader(token));
  return response;
}
