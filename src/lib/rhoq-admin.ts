import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const RHOQ_ADMIN_COOKIE = "rhoq_admin_session";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type RhoqAdminSessionPayload = {
  role: "admin";
  exp: number;
};

function signingSecret() {
  const explicit = process.env.RHOQ_ADMIN_SECRET?.trim();
  if (explicit) return explicit;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) return `rhoq-admin:${service}`;
  throw new Error("RHOQ_ADMIN_SECRET is not configured");
}

function b64urlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function b64urlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payloadB64: string) {
  return createHmac("sha256", signingSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function encodeRhoqAdminSessionCookie(
  payload?: { exp?: number }
) {
  const body: RhoqAdminSessionPayload = {
    role: "admin",
    exp: payload?.exp ?? Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS
  };
  const payloadB64 = b64urlEncode(JSON.stringify(body));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function decodeRhoqAdminSessionCookie(
  token: string | null | undefined
): RhoqAdminSessionPayload | null {
  if (!token?.includes(".")) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(b64urlDecode(payloadB64)) as RhoqAdminSessionPayload;
    if (parsed?.role !== "admin" || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { role: "admin", exp: parsed.exp };
  } catch {
    return null;
  }
}

export function rhoqAdminSessionCookieHeader(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${RHOQ_ADMIN_COOKIE}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearRhoqAdminSessionCookieHeader() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${RHOQ_ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

export async function readRhoqAdminSession(): Promise<RhoqAdminSessionPayload | null> {
  try {
    const jar = await cookies();
    return decodeRhoqAdminSessionCookie(jar.get(RHOQ_ADMIN_COOKIE)?.value);
  } catch {
    return null;
  }
}

export function getRhoqAdminPassword() {
  return process.env.RHOQ_ADMIN_PASSWORD?.trim() ?? "";
}

export function verifyRhoqAdminPassword(password: string) {
  const expected = getRhoqAdminPassword();
  if (!expected || !password) return false;
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Same format as onboarding_recorders / isValidOnboardingUsername. */
export function isValidProfileUsername(username: string) {
  return /^[a-z0-9]([a-z0-9_-]{0,30}[a-z0-9])?$/.test(
    username.trim().toLowerCase()
  );
}

export function postImageR2Key(
  userId: string,
  kind: "post" | "before" | "after",
  ext: string,
  id: string
) {
  const user = userId.trim().replace(/^\/+|\/+$/g, "");
  const safeExt = ext.replace(/^\./, "").toLowerCase();
  if (!user) throw new Error("userId is required");
  if (!/^[a-z0-9]+$/.test(safeExt)) throw new Error("Invalid image extension");
  return `posts/${user}/${kind}-${id}.${safeExt}`;
}
