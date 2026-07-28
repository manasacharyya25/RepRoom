"use client";

import { useEffect, useId, useState } from "react";
import { startPremiumCheckout } from "@/lib/billing/checkout-client";
import {
  formatDisplayMoney,
  type DisplayPricing
} from "@/lib/billing/pricing";
import type {
  PremiumPlanId,
  PremiumPlanSelection
} from "@/lib/billing/plans";

export type { PremiumPlanId, PremiumPlanSelection };

const FALLBACK_PRICING: DisplayPricing = {
  market: "WW",
  currency: "$",
  hourlyRate: 1,
  monthly: 12,
  annual: 119,
  minHours: 10,
  maxHours: 30
};

type PremiumPlanModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called just before redirecting to Dodo checkout. */
  onContinue?: (selection: PremiumPlanSelection) => void;
};

export function PremiumPlanModal({
  open,
  onClose,
  onContinue
}: PremiumPlanModalProps) {
  const titleId = useId();
  const [planId, setPlanId] = useState<PremiumPlanId>("monthly");
  const [hours, setHours] = useState(FALLBACK_PRICING.minHours);
  const [pricing, setPricing] = useState<DisplayPricing>(FALLBACK_PRICING);
  const [pricingReady, setPricingReady] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCheckoutBusy(false);
    setCheckoutError(null);
    setPricingReady(false);

    let cancelled = false;
    void (async () => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await fetch(
          `/api/billing/pricing?tz=${encodeURIComponent(timezone)}`
        );
        const data = (await response.json().catch(() => null)) as
          | (Partial<DisplayPricing> & { ok?: boolean })
          | null;
        if (cancelled || !response.ok || !data) {
          if (!cancelled) {
            setPricing(FALLBACK_PRICING);
            setHours(FALLBACK_PRICING.minHours);
          }
          return;
        }
        const next: DisplayPricing = {
          market: data.market === "IN" ? "IN" : "WW",
          currency: data.currency?.trim() || FALLBACK_PRICING.currency,
          hourlyRate:
            typeof data.hourlyRate === "number"
              ? data.hourlyRate
              : FALLBACK_PRICING.hourlyRate,
          monthly:
            typeof data.monthly === "number"
              ? data.monthly
              : FALLBACK_PRICING.monthly,
          annual:
            typeof data.annual === "number"
              ? data.annual
              : FALLBACK_PRICING.annual,
          minHours:
            typeof data.minHours === "number"
              ? data.minHours
              : FALLBACK_PRICING.minHours,
          maxHours:
            typeof data.maxHours === "number"
              ? data.maxHours
              : FALLBACK_PRICING.maxHours
        };
        setPricing(next);
        setHours((prev) =>
          Math.min(next.maxHours, Math.max(next.minHours, prev))
        );
      } catch {
        if (!cancelled) {
          setPricing(FALLBACK_PRICING);
          setHours(FALLBACK_PRICING.minHours);
        }
      } finally {
        if (!cancelled) setPricingReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open && !checkoutBusy) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, checkoutBusy]);

  useEffect(() => {
    if (!open || checkoutBusy) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, checkoutBusy, onClose]);

  if (!open && !checkoutBusy) return null;

  if (checkoutBusy) {
    return (
      <div
        className="checkout-loading-page"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-labelledby={titleId}
      >
        <div className="checkout-loading-inner">
          <div className="checkout-loading-spinner" aria-hidden="true" />
          <h2 id={titleId}>Taking you to checkout</h2>
          <p>Hang tight — we&apos;re opening Dodo Payments securely.</p>
        </div>
      </div>
    );
  }

  if (!pricingReady) {
    return (
      <div
        className="premium-plan-backdrop"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="premium-plan-modal premium-plan-modal--loading"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy="true"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="premium-plan-close premium-plan-close--loading"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
          <div className="premium-plan-loading" role="status" aria-live="polite">
            <div className="checkout-loading-spinner" aria-hidden="true" />
            <h2 id={titleId}>Finding your prices</h2>
            <p>Detecting your location…</p>
          </div>
        </div>
      </div>
    );
  }

  const money = (amount: number) => formatDisplayMoney(amount, pricing.currency);
  const hourlyTotal = hours * pricing.hourlyRate;
  const total =
    planId === "hourly"
      ? hourlyTotal
      : planId === "monthly"
        ? pricing.monthly
        : pricing.annual;

  const selection: PremiumPlanSelection = {
    planId,
    hours: planId === "hourly" ? hours : null,
    totalUsd: total
  };

  async function onConfirm() {
    setCheckoutBusy(true);
    setCheckoutError(null);
    onContinue?.(selection);
    try {
      await startPremiumCheckout(selection);
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Could not start checkout"
      );
      setCheckoutBusy(false);
    }
  }

  const marketLabel = pricing.market === "IN" ? "India" : "Worldwide";

  return (
    <div
      className="premium-plan-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="premium-plan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="premium-plan-header">
          <div>
            <p className="premium-plan-kicker">RhoQ Premium · {marketLabel}</p>
            <h2 id={titleId}>Choose your plan</h2>
          </div>
          <button
            type="button"
            className="premium-plan-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <p className="premium-plan-lead">
          Unlimited live rooms, broadcast time, and the full community
          experience.
        </p>

        <div className="premium-plan-options" role="radiogroup" aria-label="Plans">
          <label
            className={`premium-plan-option${
              planId === "hourly" ? " is-selected" : ""
            }`}
          >
            <input
              type="radio"
              name="premium-plan"
              value="hourly"
              checked={planId === "hourly"}
              onChange={() => setPlanId("hourly")}
            />
            <div className="premium-plan-option-top">
              <span className="premium-plan-name">Hourly</span>
              <span className="premium-plan-price">
                {money(pricing.hourlyRate)}
                <span>/hour</span>
              </span>
            </div>
            <p className="premium-plan-detail">
              Pay as you go. Starts at {pricing.minHours} hours (
              {money(pricing.minHours * pricing.hourlyRate)}).
            </p>
            {planId === "hourly" ? (
              <div className="premium-plan-hours">
                <div className="premium-plan-hours-label">
                  <span>Hours</span>
                  <strong>
                    {hours} · {money(hourlyTotal)}
                  </strong>
                </div>
                <input
                  type="range"
                  className="premium-plan-hours-slider"
                  min={pricing.minHours}
                  max={pricing.maxHours}
                  step={1}
                  value={hours}
                  aria-label="Number of hours"
                  aria-valuemin={pricing.minHours}
                  aria-valuemax={pricing.maxHours}
                  aria-valuenow={hours}
                  onChange={(event) =>
                    setHours(Number.parseInt(event.target.value, 10))
                  }
                />
                <div className="premium-plan-hours-range">
                  <span>{pricing.minHours}</span>
                  <span>{pricing.maxHours}</span>
                </div>
              </div>
            ) : null}
          </label>

          <label
            className={`premium-plan-option${
              planId === "monthly" ? " is-selected" : ""
            }`}
          >
            <input
              type="radio"
              name="premium-plan"
              value="monthly"
              checked={planId === "monthly"}
              onChange={() => setPlanId("monthly")}
            />
            <div className="premium-plan-option-top">
              <span className="premium-plan-name">Monthly</span>
              <span className="premium-plan-price">
                {money(pricing.monthly)}
                <span>/month</span>
              </span>
            </div>
            <p className="premium-plan-detail">
              Full Premium access billed every month. Cancel anytime.
            </p>
          </label>

          <label
            className={`premium-plan-option${
              planId === "yearly" ? " is-selected" : ""
            }`}
          >
            <input
              type="radio"
              name="premium-plan"
              value="yearly"
              checked={planId === "yearly"}
              onChange={() => setPlanId("yearly")}
            />
            <div className="premium-plan-option-top">
              <span className="premium-plan-name">
                Yearly
                <span className="premium-plan-badge">Best value</span>
              </span>
              <span className="premium-plan-price">
                {money(pricing.annual)}
                <span>/year</span>
              </span>
            </div>
            <p className="premium-plan-detail">
              Save {money(pricing.monthly * 12 - pricing.annual)} vs monthly —
              about {money(pricing.annual / 12)}/month.
            </p>
          </label>
        </div>

        <div className="premium-plan-footer">
          <p className="premium-plan-total">
            Total <strong>{money(total)}</strong>
          </p>
          {checkoutError ? (
            <p className="premium-plan-error" role="alert">
              {checkoutError}
            </p>
          ) : null}
          <div className="premium-plan-actions">
            <button
              type="button"
              className="upgrade-prompt-btn upgrade-prompt-btn--ghost"
              onClick={onClose}
            >
              Not now
            </button>
            <button
              type="button"
              className="upgrade-prompt-btn"
              onClick={() => void onConfirm()}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
