import { createHmac, timingSafeEqual } from "crypto";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";

export const ONBOARDING_RECORDER_COOKIE = "rhoq_onboard_session";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

export type OnboardingRecorderRow = {
  id: string;
  username: string;
  password_hash: string;
  max_seconds: number;
  seconds_used: number;
  active: boolean;
};

export type OnboardingSessionPayload = {
  recorderId: string;
  username: string;
  exp: number;
};

function signingSecret() {
  const explicit = process.env.ONBOARDING_RECORDER_SECRET?.trim();
  if (explicit) return explicit;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) return `onboard:${service}`;
  throw new Error("ONBOARDING_RECORDER_SECRET is not configured");
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

export function encodeOnboardingSessionCookie(
  payload: Omit<OnboardingSessionPayload, "exp"> & { exp?: number }
) {
  const body: OnboardingSessionPayload = {
    recorderId: payload.recorderId,
    username: payload.username.trim().toLowerCase(),
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS
  };
  const payloadB64 = b64urlEncode(JSON.stringify(body));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function decodeOnboardingSessionCookie(
  token: string | null | undefined
): OnboardingSessionPayload | null {
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
    const parsed = JSON.parse(b64urlDecode(payloadB64)) as OnboardingSessionPayload;
    if (
      !parsed?.recorderId ||
      !parsed?.username ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      recorderId: parsed.recorderId,
      username: parsed.username.trim().toLowerCase(),
      exp: parsed.exp
    };
  } catch {
    return null;
  }
}

export function onboardingSessionCookieHeader(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ONBOARDING_RECORDER_COOKIE}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearOnboardingSessionCookieHeader() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ONBOARDING_RECORDER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

export async function readOnboardingSession(): Promise<OnboardingSessionPayload | null> {
  try {
    const jar = await cookies();
    return decodeOnboardingSessionCookie(
      jar.get(ONBOARDING_RECORDER_COOKIE)?.value
    );
  } catch {
    return null;
  }
}

export async function verifyOnboardingPassword(
  password: string,
  passwordHash: string
) {
  try {
    return await compare(password, passwordHash);
  } catch {
    return false;
  }
}

export function remainingSeconds(row: Pick<OnboardingRecorderRow, "max_seconds" | "seconds_used">) {
  return Math.max(0, row.max_seconds - row.seconds_used);
}

export function isValidOnboardingUsername(username: string) {
  return /^[a-z0-9]([a-z0-9_-]{0,30}[a-z0-9])?$/.test(
    username.trim().toLowerCase()
  );
}

/** R2 folder: live/onboarding/{user_id}/{session_id} */
export function onboardingR2Folder(userId: string, sessionId: string) {
  const user = userId.trim().replace(/^\/+|\/+$/g, "");
  const session = sessionId.trim().replace(/^\/+|\/+$/g, "");
  if (!user || !session) throw new Error("userId and sessionId are required");
  return `live/onboarding/${user}/${session}`;
}

export function onboardingChunkKey(options: {
  userId: string;
  sessionId: string;
  chunkIndex: number;
}) {
  const pad = String(Math.max(0, Math.floor(options.chunkIndex))).padStart(6, "0");
  return `${onboardingR2Folder(options.userId, options.sessionId)}/chunk_${pad}.webm`;
}
