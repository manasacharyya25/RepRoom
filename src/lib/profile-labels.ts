const AGE_RANGE_LABELS: Record<string, string> = {
  "18-24": "18–24",
  "25-34": "25–34",
  "35-44": "35–44",
  "45+": "45+"
};

const COUNTRY_LABELS: Record<string, string> = {
  in: "India",
  us: "United States",
  gb: "United Kingdom",
  ca: "Canada",
  au: "Australia",
  sg: "Singapore",
  ae: "United Arab Emirates",
  other: "Somewhere else"
};

export function formatAgeRange(ageRange: string | null | undefined) {
  if (!ageRange) return null;
  return AGE_RANGE_LABELS[ageRange] ?? ageRange;
}

export function formatCountry(countryCode: string | null | undefined) {
  if (!countryCode) return null;
  return COUNTRY_LABELS[countryCode] ?? countryCode.toUpperCase();
}

export function formatHoursWorked(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value || value <= 0) return "0 hrs";
  const rounded =
    value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} hrs`;
}
