import {
  REFERRAL_STORAGE_KEY,
  normalizeReferralCode
} from "@/lib/referrals";

export function readStoredReferralCode() {
  if (typeof window === "undefined") return null;
  try {
    return normalizeReferralCode(window.localStorage.getItem(REFERRAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredReferralCode(code: string) {
  const normalized = normalizeReferralCode(code);
  if (!normalized || typeof window === "undefined") return null;
  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
  } catch {
    // Private mode / blocked storage — cookie still covers apply.
  }
  return normalized;
}

export function clearStoredReferralCode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}
