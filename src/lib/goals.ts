/** Hours goal target = nearest multiple of 50, always ahead of current. */
export function hoursGoalTarget(currentHours: number): number {
  const current = Math.max(0, currentHours);
  if (current <= 0) return 50;

  const nearest = Math.round(current / 50) * 50;
  const target = Math.max(50, nearest);
  return target <= current ? target + 50 : target;
}

export function goalProgress(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

export function toKg(value: number, unit: "kg" | "lbs"): number {
  return unit === "kg" ? value : value / 2.20462;
}

export function heightToCm(input: {
  unit: "imperial" | "metric";
  feet: number;
  inches: number;
  cm: number;
}): number {
  if (input.unit === "metric") return input.cm;
  return (input.feet * 12 + input.inches) * 2.54;
}

export function slugifyUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 32)
    .replace(/[_-]+$/g, "");
}

export function stripCacheBust(url: string) {
  return url.split("?")[0] ?? url;
}
