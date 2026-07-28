import type { NextRequest, NextResponse } from "next/server";

export const ONBOARDING_COMPLETE_COOKIE = "rhoq_ob_complete";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

function signingSecret() {
  return (
    process.env.ONBOARDING_STATUS_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "rhoq-onboarding-status"
  );
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]!);
  }
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqualString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(userId: string) {
  const key = await hmacKey();
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`ob-complete:${userId}`)
  );
  return bytesToBase64Url(mac);
}

export async function buildOnboardingCompleteCookieValue(userId: string) {
  return `${userId}.${await sign(userId)}`;
}

export async function readOnboardingCompleteCookie(
  request: NextRequest,
  userId: string
): Promise<boolean> {
  const raw = request.cookies.get(ONBOARDING_COMPLETE_COOKIE)?.value;
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot <= 0) return false;
  const cookieUserId = raw.slice(0, dot);
  const cookieSig = raw.slice(dot + 1);
  if (cookieUserId !== userId || !cookieSig) return false;
  const expected = await sign(userId);
  return timingSafeEqualString(cookieSig, expected);
}

export async function setOnboardingCompleteCookie(
  response: NextResponse,
  userId: string
) {
  response.cookies.set({
    name: ONBOARDING_COMPLETE_COOKIE,
    value: await buildOnboardingCompleteCookieValue(userId),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS
  });
}

export function clearOnboardingCompleteCookie(response: NextResponse) {
  response.cookies.set({
    name: ONBOARDING_COMPLETE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
