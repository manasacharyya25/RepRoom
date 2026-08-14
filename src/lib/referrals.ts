export const REFERRAL_COOKIE = "rhoq_ref";
export const REFERRAL_STORAGE_KEY = "rhoq_ref";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const REFERRAL_PREMIUM_GOAL = 10;

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6,12}$/;

export function normalizeReferralCode(raw: string | null | undefined) {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) return null;
  return code;
}

export function referralSharePath(code: string) {
  return `/r/${encodeURIComponent(code)}`;
}

export type ReferralApplyReason =
  | "applied"
  | "already_applied"
  | "invalid"
  | "not_found"
  | "self"
  | "unauthenticated"
  | "skipped";

export type ReferralPerson = {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
  premium: boolean;
};

export type ReferralMeResponse = {
  referralCode: string | null;
  shareUrl: string | null;
  referredBy: boolean;
  pendingCode: string | null;
  revenueShareEligible: boolean;
  revenueShareInterested: boolean;
  premiumCount: number;
  goal: number;
  referrals: ReferralPerson[];
};
