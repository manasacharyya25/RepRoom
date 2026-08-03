import type { SupabaseClient } from "@supabase/supabase-js";
import {
  broadcastQuotaSeconds,
  getTier,
  resolveBroadcastMeterMode,
  type BroadcastMeterMode,
  type ProfilePlan,
  type Tier
} from "@/lib/entitlements";
import { PREMIUM_WALL_ENABLED } from "@/lib/feature-flags";
import {
  getRequestIpHash,
  hashDeviceFingerprint,
  resolveGuestId,
  subjectKeyForGuest,
  subjectKeyForUser
} from "@/lib/guest-identity";
import { createClient } from "@/lib/supabase/server";

export type AccessContext = {
  tier: Tier;
  subjectKey: string;
  userId: string | null;
  guestId: string | null;
  deviceHash: string;
  ipHash: string;
  /** Daily quota used with room_usage_daily when meter mode is free/premium daily. */
  quotaSeconds: number;
  plan: ProfilePlan | null;
  creditSeconds: number;
  meterMode: BroadcastMeterMode;
  /**
   * Whether the client should show remaining time / upgrade UX.
   * False for premium (silent cap), guests, and when premium wall is disabled.
   */
  metersBroadcastUx: boolean;
};

export async function resolveAccessContext(
  fingerprint: string,
  clientGuestId?: string | null
): Promise<AccessContext> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const ipHash = await getRequestIpHash();
  const deviceHash = hashDeviceFingerprint(fingerprint || "unknown", ipHash);

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, broadcast_credit_seconds")
      .eq("id", user.id)
      .maybeSingle();
    const plan = (profile?.plan as ProfilePlan | undefined) ?? "free";
    const creditSeconds = Math.max(
      0,
      Number(profile?.broadcast_credit_seconds ?? 0)
    );
    const tier = getTier({ userId: user.id, plan });
    const meterMode = resolveBroadcastMeterMode({ tier, creditSeconds });
    const quotaSeconds =
      meterMode === "free_daily" || meterMode === "premium_silent_daily"
        ? broadcastQuotaSeconds(tier)
        : 0;

    return {
      tier,
      subjectKey: subjectKeyForUser(user.id),
      userId: user.id,
      guestId: null,
      deviceHash,
      ipHash,
      quotaSeconds,
      plan,
      creditSeconds,
      meterMode,
      metersBroadcastUx:
        PREMIUM_WALL_ENABLED &&
        (meterMode === "free_daily" || meterMode === "credit_bank")
    };
  }

  const guestId = await resolveGuestId({
    supabase,
    deviceHash,
    clientGuestId
  });
  const tier: Tier = "guest";
  return {
    tier,
    subjectKey: subjectKeyForGuest(guestId),
    userId: null,
    guestId,
    deviceHash,
    ipHash,
    quotaSeconds: 0,
    plan: null,
    creditSeconds: 0,
    meterMode: "none",
    metersBroadcastUx: false
  };
}

export async function getUsage(
  supabase: SupabaseClient,
  subjectKey: string,
  quotaSeconds: number
) {
  const { data, error } = await supabase.rpc("room_usage_get", {
    p_subject_key: subjectKey,
    p_quota: quotaSeconds
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    secondsUsed: Number(row?.seconds_used ?? 0),
    remainingSeconds:
      row?.remaining_seconds === null || row?.remaining_seconds === undefined
        ? quotaSeconds <= 0
          ? null
          : quotaSeconds
        : Number(row.remaining_seconds)
  };
}

export async function addUsageSeconds(
  supabase: SupabaseClient,
  subjectKey: string,
  seconds: number,
  quotaSeconds: number
) {
  const { data, error } = await supabase.rpc("room_usage_add_seconds", {
    p_subject_key: subjectKey,
    p_seconds: seconds,
    p_quota: quotaSeconds
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    secondsUsed: Number(row?.seconds_used ?? 0),
    remainingSeconds:
      row?.remaining_seconds === null || row?.remaining_seconds === undefined
        ? quotaSeconds <= 0
          ? null
          : 0
        : Number(row.remaining_seconds)
  };
}

export async function burnBroadcastCredits(
  supabase: SupabaseClient,
  userId: string,
  seconds: number
) {
  const { data, error } = await supabase.rpc("broadcast_credit_burn", {
    p_user_id: userId,
    p_seconds: seconds
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    creditSeconds: Number(row?.credit_seconds ?? 0),
    burned: Number(row?.burned ?? 0)
  };
}

/**
 * Apply broadcast seconds for the current access context.
 * Returns UX-facing remaining/exhausted plus serverStop for silent premium cap.
 */
export async function applyBroadcastSeconds(
  supabase: SupabaseClient,
  ctx: AccessContext,
  seconds: number
): Promise<{
  remainingSeconds: number | null;
  secondsUsed: number;
  creditSeconds: number;
  exhaustedUx: boolean;
  serverStop: boolean;
}> {
  const add = Math.max(0, Math.round(seconds));

  if (ctx.meterMode === "none" || !ctx.userId) {
    return {
      remainingSeconds: null,
      secondsUsed: 0,
      creditSeconds: ctx.creditSeconds,
      exhaustedUx: false,
      serverStop: false
    };
  }

  if (ctx.meterMode === "credit_bank") {
    const result =
      add > 0
        ? await burnBroadcastCredits(supabase, ctx.userId, add)
        : { creditSeconds: ctx.creditSeconds, burned: 0 };
    const exhausted = result.creditSeconds <= 0;
    return {
      remainingSeconds: PREMIUM_WALL_ENABLED ? result.creditSeconds : null,
      secondsUsed: 0,
      creditSeconds: result.creditSeconds,
      exhaustedUx: PREMIUM_WALL_ENABLED && exhausted,
      serverStop: exhausted
    };
  }

  // free_daily or premium_silent_daily
  const usage =
    add > 0
      ? await addUsageSeconds(
          supabase,
          ctx.subjectKey,
          add,
          ctx.quotaSeconds
        )
      : await getUsage(supabase, ctx.subjectKey, ctx.quotaSeconds);

  const over =
    usage.remainingSeconds !== null && usage.remainingSeconds <= 0;

  if (ctx.meterMode === "premium_silent_daily") {
    return {
      remainingSeconds: null,
      secondsUsed: usage.secondsUsed,
      creditSeconds: ctx.creditSeconds,
      exhaustedUx: false,
      serverStop: over
    };
  }

  return {
    remainingSeconds: usage.remainingSeconds,
    secondsUsed: usage.secondsUsed,
    creditSeconds: ctx.creditSeconds,
    exhaustedUx: over,
    serverStop: over
  };
}
