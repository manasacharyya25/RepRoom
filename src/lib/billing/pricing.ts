export type BillingMarket = "IN" | "WW";

export const DISPLAY_HOURLY_MIN_HOURS = 10;
export const DISPLAY_HOURLY_MAX_HOURS = 30;

export type DisplayPricing = {
  market: BillingMarket;
  /** Currency symbol or ISO code from env (e.g. "$", "₹", "USD", "INR"). */
  currency: string;
  hourlyRate: number;
  monthly: number;
  annual: number;
  minHours: number;
  maxHours: number;
};

function parseAmount(raw: string | undefined, fallback: number) {
  if (!raw?.trim()) return fallback;
  const n = Number(raw.trim().replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** India market from OS/IANA timezone (e.g. Asia/Kolkata). */
export function resolveBillingMarket(timezone: string | null | undefined): BillingMarket {
  const tz = timezone?.trim();
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "IN";
  return "WW";
}

/** Server-side display prices from DODO_PRODUCT_*_WW / _IN env vars. */
export function getDisplayPricing(market: BillingMarket): DisplayPricing {
  if (market === "IN") {
    return {
      market,
      currency: process.env.DODO_PRODUCT_CURRENCY_IN?.trim() || "₹",
      hourlyRate: parseAmount(process.env.DODO_PRODUCT_HOUR_IN, 100),
      monthly: parseAmount(process.env.DODO_PRODUCT_MONTHLY_IN, 499),
      annual: parseAmount(process.env.DODO_PRODUCT_ANNUAL_IN, 4999),
      minHours: DISPLAY_HOURLY_MIN_HOURS,
      maxHours: DISPLAY_HOURLY_MAX_HOURS
    };
  }

  return {
    market,
    currency: process.env.DODO_PRODUCT_CURRENCY_WW?.trim() || "$",
    hourlyRate: parseAmount(process.env.DODO_PRODUCT_HOUR_WW, 1),
    monthly: parseAmount(process.env.DODO_PRODUCT_MONTHLY_WW, 12),
    annual: parseAmount(process.env.DODO_PRODUCT_ANNUAL_WW, 119),
    minHours: DISPLAY_HOURLY_MIN_HOURS,
    maxHours: DISPLAY_HOURLY_MAX_HOURS
  };
}

export function formatDisplayMoney(amount: number, currency: string) {
  const code = currency.trim();
  if (/^[A-Za-z]{3}$/.test(code)) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code.toUpperCase(),
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);

  return `${code}${formatted}`;
}
