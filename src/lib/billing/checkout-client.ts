import type { PremiumPlanSelection } from "@/lib/billing/plans";

export async function startPremiumCheckout(selection: PremiumPlanSelection) {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planId: selection.planId,
      hours: selection.hours ?? undefined
    })
  });

  const data = (await response.json().catch(() => null)) as {
    checkoutUrl?: string;
    error?: string;
  } | null;

  if (!response.ok || !data?.checkoutUrl) {
    throw new Error(data?.error || "Could not start checkout");
  }

  window.location.assign(data.checkoutUrl);
}
