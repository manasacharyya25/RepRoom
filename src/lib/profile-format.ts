import { goalProgress } from "@/lib/goals";
import type { Goal } from "@/lib/types/profile";

function formatUnitValue(value: number | null, unit: string | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded =
    unit === "hours" || unit === "kg"
      ? Math.round(value * 10) / 10
      : Math.round(value);

  if (!unit) return String(rounded);
  if (unit === "kcal") return `${rounded} kcal`;
  if (unit === "kg") return `${rounded} kg`;
  if (unit === "hours") return `${rounded} hrs`;
  if (unit === "days") return `${rounded} days`;
  return `${rounded} ${unit}`;
}

export function formatGoalDetail(goal: Goal): string {
  if (goal.current_value != null && goal.target_value != null) {
    const current = formatUnitValue(goal.current_value, goal.unit);
    const target = formatUnitValue(goal.target_value, goal.unit);
    if (goal.template_id === "target_weight") {
      return `Current: ${current} · Target: ${target}`;
    }
    if (goal.template_id === "lift_target") {
      return `Current: ${current} · Target: ${target}`;
    }
    if (goal.template_id === "train_weekly") {
      return `${Math.round(goal.current_value)} / ${Math.round(goal.target_value)} sessions`;
    }
    if (goal.template_id === "mobility_streak") {
      return `${Math.round(goal.current_value)} day streak · Target ${Math.round(goal.target_value)}`;
    }
    if (goal.template_id === "meal_prep") {
      return `${current} → ${target}`;
    }
    if (goal.template_id === "hours_worked") {
      return `${current} / ${target}`;
    }
    return `${current} / ${target}`;
  }

  if (goal.detail?.trim()) return goal.detail;
  return "Keep showing up";
}

export function resolveGoalProgress(goal: Goal): number {
  if (goal.current_value != null && goal.target_value != null) {
    return goalProgress(Number(goal.current_value), Number(goal.target_value));
  }
  return goal.progress ?? 0;
}
