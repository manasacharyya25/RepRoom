import { GUEST_VIEW_SECONDS } from "@/lib/entitlements";

export const GUEST_VIEW_QUOTA_KEY = "rhoq_guest_view_quota";

type GuestViewQuota = {
  /** UTC calendar date `YYYY-MM-DD`. */
  date: string;
  secondsUsed: number;
};

function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function readQuota(): GuestViewQuota {
  const empty: GuestViewQuota = { date: utcDateKey(), secondsUsed: 0 };
  if (typeof window === "undefined") return empty;

  try {
    const raw = window.localStorage.getItem(GUEST_VIEW_QUOTA_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<GuestViewQuota>;
    const date =
      typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
        ? parsed.date
        : utcDateKey();
    const secondsUsed = Math.max(0, Math.floor(Number(parsed.secondsUsed) || 0));
    if (date !== utcDateKey()) {
      return empty;
    }
    return { date, secondsUsed };
  } catch {
    return empty;
  }
}

function writeQuota(quota: GuestViewQuota) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_VIEW_QUOTA_KEY, JSON.stringify(quota));
  } catch {
    /* private mode / blocked storage */
  }
}

export function getGuestViewSecondsUsed(): number {
  return readQuota().secondsUsed;
}

export function getGuestViewRemainingSeconds(
  quotaSeconds = GUEST_VIEW_SECONDS
): number {
  return Math.max(0, quotaSeconds - getGuestViewSecondsUsed());
}

/** Add seconds to today's guest view usage. Returns remaining seconds. */
export function addGuestViewSeconds(
  seconds: number,
  quotaSeconds = GUEST_VIEW_SECONDS
): number {
  const add = Math.max(0, Math.floor(seconds));
  if (add <= 0) return getGuestViewRemainingSeconds(quotaSeconds);

  const current = readQuota();
  const next: GuestViewQuota = {
    date: utcDateKey(),
    secondsUsed: Math.min(quotaSeconds, current.secondsUsed + add)
  };
  writeQuota(next);
  return Math.max(0, quotaSeconds - next.secondsUsed);
}
