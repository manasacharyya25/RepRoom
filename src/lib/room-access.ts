import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getTier,
  roomQuotaSeconds,
  type ProfilePlan,
  type Tier
} from "@/lib/entitlements";
import {
  getOrCreateGuestId,
  getRequestIpHash,
  hashDeviceFingerprint,
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
  quotaSeconds: number;
  plan: ProfilePlan | null;
};

export async function resolveAccessContext(
  fingerprint: string
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
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();
    const plan = (profile?.plan as ProfilePlan | undefined) ?? "free";
    const tier = getTier({ userId: user.id, plan });
    return {
      tier,
      subjectKey: subjectKeyForUser(user.id),
      userId: user.id,
      guestId: null,
      deviceHash,
      ipHash,
      quotaSeconds: roomQuotaSeconds(tier),
      plan
    };
  }

  const guestId = await getOrCreateGuestId();
  const tier: Tier = "guest";
  return {
    tier,
    subjectKey: subjectKeyForGuest(guestId),
    userId: null,
    guestId,
    deviceHash,
    ipHash,
    quotaSeconds: roomQuotaSeconds(tier),
    plan: null
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
