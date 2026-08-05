import { Capacitor } from "@capacitor/core";

/** Must match `appId` in capacitor.config.ts and Android custom_url_scheme. */
export const CAPACITOR_APP_ID = "app.rhoq.mobile";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/**
 * OAuth / magic-link return URL.
 * Native: custom scheme deep link (handled client-side).
 * Web: Next.js `/auth/callback` route (server exchange).
 */
export function buildAuthCallbackUrl(nextPath: string) {
  const safeNext = nextPath.startsWith("/") ? nextPath : "/rooms";
  const nextQuery = `next=${encodeURIComponent(safeNext)}`;

  if (isNativeApp()) {
    return `${CAPACITOR_APP_ID}://auth/callback?${nextQuery}`;
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/auth/callback?${nextQuery}`;
}

export function isCapacitorAuthCallbackUrl(url: string) {
  return (
    url.startsWith(`${CAPACITOR_APP_ID}://auth/callback`) ||
    url.startsWith(`${CAPACITOR_APP_ID}:///auth/callback`)
  );
}

export function parseAuthCallbackUrl(url: string): {
  code: string | null;
  error: string | null;
  nextPath: string;
} {
  try {
    const parsed = new URL(url);
    const nextParam = parsed.searchParams.get("next");
    return {
      code: parsed.searchParams.get("code"),
      error:
        parsed.searchParams.get("error_description") ||
        parsed.searchParams.get("error"),
      nextPath:
        nextParam && nextParam.startsWith("/") ? nextParam : "/rooms"
    };
  } catch {
    const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
    const params = new URLSearchParams(query);
    const nextParam = params.get("next");
    return {
      code: params.get("code"),
      error: params.get("error_description") || params.get("error"),
      nextPath:
        nextParam && nextParam.startsWith("/") ? nextParam : "/rooms"
    };
  }
}
