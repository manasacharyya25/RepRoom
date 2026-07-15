import { createHash, randomUUID } from "crypto";
import { cookies, headers } from "next/headers";

export const GUEST_COOKIE = "satara_guest_id";

export async function getOrCreateGuestId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value?.trim();
  if (existing && existing.length >= 8) return existing;

  const id = randomUUID();
  try {
    jar.set(GUEST_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production"
    });
  } catch {
    /* set may fail in some RSC contexts; route handlers can set on response */
  }
  return id;
}

export function guestCookieHeaderValue(guestId: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${GUEST_COOKIE}=${guestId}; Path=/; Max-Age=${60 * 60 * 24 * 365}; HttpOnly; SameSite=Lax${secure}`;
}

export async function getRequestIpHash(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export function hashDeviceFingerprint(fingerprint: string, ipHash: string) {
  return createHash("sha256")
    .update(`${fingerprint.trim()}|${ipHash}`)
    .digest("hex")
    .slice(0, 40);
}

export function subjectKeyForUser(userId: string) {
  return `user:${userId}`;
}

export function subjectKeyForGuest(guestId: string) {
  return `guest:${guestId}`;
}
