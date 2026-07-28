import { NextResponse } from "next/server";
import { clearOnboardingCompleteCookie } from "@/lib/onboarding-status-cookie";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearOnboardingCompleteCookie(response);
  return response;
}
