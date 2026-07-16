import { createHash, randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GUEST_COOKIE = "satara_guest_id";

function isUsableGuestId(value: string | null | undefined): value is string {
  return Boolean(value && value.trim().length >= 8);
}

export async function readGuestCookie(): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value?.trim();
  return isUsableGuestId(existing) ? existing : null;
}

/**
 * Resolve a stable guest id for view-quota continuity:
 * 1) HttpOnly cookie
 * 2) prior device_hash → guest_id map (server)
 * 3) client localStorage id
 * 4) new UUID
 */
export async function resolveGuestId(options: {
  supabase: SupabaseClient;
  deviceHash: string;
  clientGuestId?: string | null;
}): Promise<string> {
  const cookieGuestId = await readGuestCookie();
  const clientGuestId = isUsableGuestId(options.clientGuestId)
    ? options.clientGuestId.trim()
    : null;

  try {
    const { data, error } = await options.supabase.rpc("guest_resolve_id", {
      p_device_hash: options.deviceHash,
      p_cookie_guest_id: cookieGuestId,
      p_client_guest_id: clientGuestId
    });
    if (!error && isUsableGuestId(typeof data === "string" ? data : null)) {
      return (data as string).trim();
    }
  } catch {
    /* migration may not be applied yet — fall back below */
  }

  return cookieGuestId ?? clientGuestId ?? randomUUID();
}

/** @deprecated Prefer resolveGuestId for returning-guest continuity. */
export async function getOrCreateGuestId(): Promise<string> {
  const existing = await readGuestCookie();
  if (existing) return existing;

  const id = randomUUID();
  try {
    const jar = await cookies();
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
