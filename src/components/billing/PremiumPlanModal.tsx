"use client";

import { useEffect, useId, useState } from "react";

export type PremiumPlanId = "hourly" | "monthly" | "yearly";

export type PremiumPlanSelection = {
  planId: PremiumPlanId;
  /** Hours purchased when plan is hourly; otherwise null. */
  hours: number | null;
  totalUsd: number;
};

const HOURLY_RATE_USD = 0.5;
const HOURLY_MIN_HOURS = 10;
const HOURLY_MAX_HOURS = 30;
const MONTHLY_USD = 12;
const YEARLY_USD = 112;

type PremiumPlanModalProps = {
  open: boolean;
  onClose: () => void;
  /** UI-only for now — called when the user confirms a plan. */
  onContinue?: (selection: PremiumPlanSelection) => void;
};

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function PremiumPlanModal({
  open,
  onClose,
  onContinue
}: PremiumPlanModalProps) {
  const titleId = useId();
  const [planId, setPlanId] = useState<PremiumPlanId>("monthly");
  const [hours, setHours] = useState(HOURLY_MIN_HOURS);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const hourlyTotal = hours * HOURLY_RATE_USD;
  const totalUsd =
    planId === "hourly"
      ? hourlyTotal
      : planId === "monthly"
        ? MONTHLY_USD
        : YEARLY_USD;

  const selection: PremiumPlanSelection = {
    planId,
    hours: planId === "hourly" ? hours : null,
    totalUsd
  };

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
            <p className="premium-plan-kicker">RhoQ Premium</p>
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
                {formatUsd(HOURLY_RATE_USD)}
                <span>/hour</span>
              </span>
            </div>
            <p className="premium-plan-detail">
              Pay as you go. Starts at {HOURLY_MIN_HOURS} hours (
              {formatUsd(HOURLY_MIN_HOURS * HOURLY_RATE_USD)}).
            </p>
            {planId === "hourly" ? (
              <div className="premium-plan-hours">
                <div className="premium-plan-hours-label">
                  <span>Hours</span>
                  <strong>
                    {hours} · {formatUsd(hourlyTotal)}
                  </strong>
                </div>
                <input
                  type="range"
                  className="premium-plan-hours-slider"
                  min={HOURLY_MIN_HOURS}
                  max={HOURLY_MAX_HOURS}
                  step={1}
                  value={hours}
                  aria-label="Number of hours"
                  aria-valuemin={HOURLY_MIN_HOURS}
                  aria-valuemax={HOURLY_MAX_HOURS}
                  aria-valuenow={hours}
                  onChange={(event) =>
                    setHours(Number.parseInt(event.target.value, 10))
                  }
                />
                <div className="premium-plan-hours-range">
                  <span>{HOURLY_MIN_HOURS}</span>
                  <span>{HOURLY_MAX_HOURS}</span>
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
                {formatUsd(MONTHLY_USD)}
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
                {formatUsd(YEARLY_USD)}
                <span>/year</span>
              </span>
            </div>
            <p className="premium-plan-detail">
              Save {formatUsd(MONTHLY_USD * 12 - YEARLY_USD)} vs monthly —
              about {formatUsd(YEARLY_USD / 12)}/month.
            </p>
          </label>
        </div>

        <div className="premium-plan-footer">
          <p className="premium-plan-total">
            Total <strong>{formatUsd(totalUsd)}</strong>
          </p>
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
              onClick={() => onContinue?.(selection)}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
