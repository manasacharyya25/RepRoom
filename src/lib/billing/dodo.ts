import type { PremiumPlanId } from "@/lib/billing/plans";
import DodoPayments from "dodopayments";

export const HOURLY_RATE_USD = 0.5;
export const HOURLY_MIN_HOURS = 10;
export const HOURLY_MAX_HOURS = 30;
export const MONTHLY_USD = 12;
export const YEARLY_USD = 119;
/** Silent premium broadcast hard-stop per UTC day (UX still shows unlimited). */
export const PREMIUM_DAILY_BROADCAST_SECONDS = 60 * 60;

export type BillingProductKind = "hourly" | "monthly" | "annual";

export function getDodoEnv() {
  const raw = process.env.DODO_PAYMENTS_ENV?.trim().toLowerCase();
  return raw === "live_mode" || raw === "live" ? "live_mode" : "test_mode";
}

export function isDodoConfigured() {
  return Boolean(
    process.env.DODO_PAYMENTS_API_KEY?.trim() &&
      process.env.DODO_PRODUCT_HOUR?.trim() &&
      process.env.DODO_PRODUCT_MONTHLY?.trim() &&
      process.env.DODO_PRODUCT_ANNUAL?.trim()
  );
}

export function createDodoClient() {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!bearerToken) {
    throw new Error("DODO_PAYMENTS_API_KEY is not configured");
  }
  return new DodoPayments({
    bearerToken,
    environment: getDodoEnv()
  });
}

export function dodoProductId(kind: BillingProductKind) {
  const map: Record<BillingProductKind, string | undefined> = {
    hourly: process.env.DODO_PRODUCT_HOUR?.trim(),
    monthly: process.env.DODO_PRODUCT_MONTHLY?.trim(),
    annual: process.env.DODO_PRODUCT_ANNUAL?.trim()
  };
  const id = map[kind];
  if (!id) throw new Error(`Missing Dodo product id for ${kind}`);
  return id;
}

export function planIdToProductKind(planId: PremiumPlanId): BillingProductKind {
  if (planId === "hourly") return "hourly";
  if (planId === "monthly") return "monthly";
  return "annual";
}

export function clampHourPack(hours: number) {
  if (!Number.isFinite(hours)) return HOURLY_MIN_HOURS;
  return Math.min(
    HOURLY_MAX_HOURS,
    Math.max(HOURLY_MIN_HOURS, Math.floor(hours))
  );
}
