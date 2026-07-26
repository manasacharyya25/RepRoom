import { NextResponse } from "next/server";
import { clearOnboardingSessionCookieHeader } from "@/lib/onboarding-recorder";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearOnboardingSessionCookieHeader());
  return response;
}
