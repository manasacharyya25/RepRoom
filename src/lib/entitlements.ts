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
export const GUEST_FEED_LIMIT = 100;
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
 * Daily broadcast quota seconds. `0` means unlimited.
 * Free: 30m while live. Premium: unlimited. Guests cannot broadcast.
 */
export function broadcastQuotaSeconds(tier: Tier): number {
  if (tier === "free") return FREE_BROADCAST_SECONDS;
  return 0;
}

/** Whether this tier meters Go Live time against a daily broadcast quota. */
export function metersBroadcast(tier: Tier): boolean {
  return tier === "free";
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
