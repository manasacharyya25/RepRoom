import { isRoomComingSoon } from "@/lib/rooms";

export type Tier = "guest" | "free" | "premium";

export type ProfilePlan = "free" | "premium";

export const GUEST_ROOM_ID = "workout";
/** Guest view timer — client localStorage, daily UTC cap. */
export const GUEST_VIEW_SECONDS = 15 * 60;
/** @deprecated Use GUEST_VIEW_SECONDS */
export const GUEST_ROOM_SECONDS = GUEST_VIEW_SECONDS;
/** Free broadcast timer — starts on Go Live, daily UTC cap. */
export const FREE_BROADCAST_SECONDS = 30 * 60;
/** @deprecated Use FREE_BROADCAST_SECONDS */
export const FREE_ROOM_SECONDS = FREE_BROADCAST_SECONDS;
/** Premium subscription silent daily hard-stop (UX still shows unlimited). */
export const PREMIUM_DAILY_BROADCAST_SECONDS = 60 * 60;
export const GUEST_FEED_LIMIT = 6;
export const ROOM_HEARTBEAT_SECONDS = 20;
export const ACTIVE_SESSION_STALE_SECONDS = 120;

export function getTier(options: {
  userId: string | null | undefined;
  plan?: ProfilePlan | string | null;
}): Tier {
  if (!options.userId) return "guest";
  if (options.plan === "premium") return "premium";
  return "free";
}

export function canAccessRoom(tier: Tier, roomId: string): boolean {
  if (isRoomComingSoon(roomId)) return false;
  if (tier === "guest") return roomId === GUEST_ROOM_ID;
  return true;
}

/**
 * Daily broadcast quota seconds for room_usage_daily.
 * Free: 30m. Premium: 1h silent cap. Guests: N/A (0).
 * Credit-bank users do not use this path while credits remain.
 */
export function broadcastQuotaSeconds(tier: Tier): number {
  if (tier === "free") return FREE_BROADCAST_SECONDS;
  if (tier === "premium") return PREMIUM_DAILY_BROADCAST_SECONDS;
  return 0;
}

/**
 * Whether Go Live time is metered for this tier.
 * Premium is metered server-side (silent 1h/day) but UX hides exhaustion.
 * Free is metered with upgrade UX. Credit bank is handled separately.
 */
export function metersBroadcast(tier: Tier): boolean {
  return tier === "free" || tier === "premium";
}

export function formatRemainingTime(remainingSeconds: number | null): string {
  if (remainingSeconds === null) return "Unlimited";
  const mins = Math.max(0, Math.ceil(remainingSeconds / 60));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m left today` : `${h}h left today`;
  }
  return `${mins}m left today`;
}

export type UpgradeReason =
  | "locked_room"
  | "guest_time"
  | "guest_feed_action"
  | "guest_feed_end"
  | "go_live_auth"
  | "free_time"
  | "soft_upgrade";

export type BroadcastMeterMode =
  | "none"
  | "free_daily"
  | "credit_bank"
  | "premium_silent_daily";

export function resolveBroadcastMeterMode(options: {
  tier: Tier;
  creditSeconds: number;
}): BroadcastMeterMode {
  if (options.tier === "guest") return "none";
  if (options.tier === "premium") return "premium_silent_daily";
  if (options.creditSeconds > 0) return "credit_bank";
  return "free_daily";
}
