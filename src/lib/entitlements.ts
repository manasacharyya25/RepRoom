export type Tier = "guest" | "free" | "premium";

export type ProfilePlan = "free" | "premium";

export const GUEST_ROOM_ID = "yoga";
/** Guest view timer — starts on room enter, daily UTC cap. */
export const GUEST_VIEW_SECONDS = 15 * 60;
/** @deprecated Use GUEST_VIEW_SECONDS */
export const GUEST_ROOM_SECONDS = GUEST_VIEW_SECONDS;
/** Free broadcast timer (future: starts on Go Live). Not used for viewing yet. */
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

/**
 * Daily view/broadcast quota seconds. `0` means unlimited.
 * Guests: view timer (15m). Free: broadcast quota (not metered on view yet).
 */
export function roomQuotaSeconds(tier: Tier): number {
  if (tier === "guest") return GUEST_VIEW_SECONDS;
  if (tier === "free") return FREE_ROOM_SECONDS;
  return 0;
}

/** Whether this tier’s room time starts counting on enter (view). */
export function metersViewTimeOnEnter(tier: Tier): boolean {
  return tier === "guest";
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
