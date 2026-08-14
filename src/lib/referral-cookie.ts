import type { NextResponse } from "next/server";
import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
  normalizeReferralCode
} from "@/lib/referrals";

export function setReferralCookie(response: NextResponse, code: string) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;
  response.cookies.set({
    name: REFERRAL_COOKIE,
    value: normalized,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFERRAL_COOKIE_MAX_AGE
  });
}

export function clearReferralCookie(response: NextResponse) {
  response.cookies.set({
    name: REFERRAL_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export { REFERRAL_COOKIE, normalizeReferralCode };
