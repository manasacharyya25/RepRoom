import type { WorkoutPlan } from "@/lib/workout-plan";

export const PLAN_GOALS = [
  "build_muscle",
  "lose_fat",
  "get_stronger",
  "improve_endurance",
  "more_flexible",
  "stay_healthy",
  "stay_consistent"
] as const;

export const PLAN_EXPERIENCE_LEVELS = [
  "beginner",
  "intermediate",
  "advanced"
] as const;

export const PLAN_DAYS_OPTIONS = [2, 3, 4, 5, 6] as const;
export const PLAN_SESSION_MINUTES = [20, 30, 45, 60, 90] as const;

export type PlanGoal = (typeof PLAN_GOALS)[number];
export type PlanExperienceLevel = (typeof PLAN_EXPERIENCE_LEVELS)[number];
export type PlanDaysPerWeek = (typeof PLAN_DAYS_OPTIONS)[number];
export type PlanSessionMinutes = (typeof PLAN_SESSION_MINUTES)[number];

export type WorkoutPlanCacheKey = {
  goal: PlanGoal;
  experience: PlanExperienceLevel;
  daysPerWeek: PlanDaysPerWeek;
  sessionMinutes: PlanSessionMinutes;
};

export type WorkoutPlanGenerateInput = {
  primaryGoal: string;
  fitnessExperience: string;
  daysPerWeek: number;
  sessionMinutes: number;
};

const GOAL_SET = new Set<string>(PLAN_GOALS);
const DAY_SET = new Set<number>(PLAN_DAYS_OPTIONS);
const MINUTE_SET = new Set<number>(PLAN_SESSION_MINUTES);

export function mapExperienceLevel(
  fitnessExperience: string
): PlanExperienceLevel {
  switch (fitnessExperience) {
    case "1_3_years":
      return "intermediate";
    case "3_plus_years":
      return "advanced";
    case "just_starting":
    case "under_1_year":
    default:
      return "beginner";
  }
}

export function experienceLabel(level: PlanExperienceLevel): string {
  switch (level) {
    case "beginner":
      return "Beginner";
    case "intermediate":
      return "Intermediate";
    case "advanced":
      return "Advanced";
  }
}

export function goalLabel(goal: PlanGoal): string {
  const labels: Record<PlanGoal, string> = {
    build_muscle: "Build Muscle",
    lose_fat: "Lose Fat",
    get_stronger: "Get Stronger",
    improve_endurance: "Improve Endurance",
    more_flexible: "Become More Flexible",
    stay_healthy: "Stay Healthy & Active",
    stay_consistent: "Stay Consistent"
  };
  return labels[goal];
}

/** Title-case / humanize plan field values for UI. */
export function humanizePlanLabel(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  if (GOAL_SET.has(raw)) {
    return goalLabel(raw as PlanGoal);
  }

  const experience = raw.toLowerCase();
  if (
    experience === "beginner" ||
    experience === "intermediate" ||
    experience === "advanced"
  ) {
    return experienceLabel(experience as PlanExperienceLevel);
  }

  return raw
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function normalizePlanCacheKey(
  input: WorkoutPlanGenerateInput
): WorkoutPlanCacheKey | null {
  const goal = input.primaryGoal.trim();
  if (!GOAL_SET.has(goal)) return null;

  const daysPerWeek = Number(input.daysPerWeek);
  const sessionMinutes = Number(input.sessionMinutes);
  if (!DAY_SET.has(daysPerWeek) || !MINUTE_SET.has(sessionMinutes)) {
    return null;
  }

  return {
    goal: goal as PlanGoal,
    experience: mapExperienceLevel(input.fitnessExperience),
    daysPerWeek: daysPerWeek as PlanDaysPerWeek,
    sessionMinutes: sessionMinutes as PlanSessionMinutes
  };
}

export function cacheKeyFingerprint(key: WorkoutPlanCacheKey): string {
  return `${key.goal}|${key.experience}|${key.daysPerWeek}|${key.sessionMinutes}`;
}

export type GeneratedPlanResult = {
  plan: WorkoutPlan;
  cached: boolean;
  source: "cache" | "ai" | "static";
};
