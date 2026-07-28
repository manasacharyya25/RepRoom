export type PremiumPlanId = "hourly" | "monthly" | "yearly";

export type PremiumPlanSelection = {
  planId: PremiumPlanId;
  /** Hours purchased when plan is hourly; otherwise null. */
  hours: number | null;
  totalUsd: number;
};
