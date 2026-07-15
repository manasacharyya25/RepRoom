export type Tier = "guest" | "free" | "premium";

export type ProfilePlan = "free" | "premium";

export const GUEST_ROOM_ID = "yoga";
export const GUEST_ROOM_SECONDS = 10 * 60;
export const FREE_ROOM_SECONDS = 30 * 60;
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
  if (tier === "guest") return roomId === GUEST_ROOM_ID;
  return true;
}

/** Quota seconds for the day. `0` means unlimited (premium). */
export function roomQuotaSeconds(tier: Tier): number {
  if (tier === "guest") return GUEST_ROOM_SECONDS;
  if (tier === "free") return FREE_ROOM_SECONDS;
  return 0;
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
  | "free_time"
  | "soft_upgrade";
