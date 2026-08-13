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

export const PLAN_FOCUS = [
  "full_body",
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core"
] as const;

export const PLAN_EQUIPMENT = [
  "none",
  "bands",
  "dumbbells",
  "home_gym",
  "full_gym"
] as const;

export const PLAN_STYLES = [
  "strength",
  "hiit",
  "yoga",
  "pilates",
  "walking",
  "jump_rope"
] as const;

export const DEFAULT_PLAN_FOCUS = "full_body" as const;
export const DEFAULT_PLAN_EQUIPMENT = "full_gym" as const;
export const DEFAULT_PLAN_STYLE = "strength" as const;

export type PlanGoal = (typeof PLAN_GOALS)[number];
export type PlanExperienceLevel = (typeof PLAN_EXPERIENCE_LEVELS)[number];
export type PlanDaysPerWeek = (typeof PLAN_DAYS_OPTIONS)[number];
export type PlanSessionMinutes = (typeof PLAN_SESSION_MINUTES)[number];
export type PlanFocus = (typeof PLAN_FOCUS)[number];
export type PlanEquipment = (typeof PLAN_EQUIPMENT)[number];
export type PlanStyle = (typeof PLAN_STYLES)[number];

export type WorkoutPlanCacheKey = {
  goal: PlanGoal;
  experience: PlanExperienceLevel;
  daysPerWeek: PlanDaysPerWeek;
  sessionMinutes: PlanSessionMinutes;
  focus: PlanFocus;
  equipment: PlanEquipment;
  style: PlanStyle;
};

export type WorkoutPlanGenerateInput = {
  primaryGoal: string;
  fitnessExperience: string;
  daysPerWeek: number;
  sessionMinutes: number;
  focus?: string;
  equipment?: string;
  style?: string;
};

const GOAL_SET = new Set<string>(PLAN_GOALS);
const DAY_SET = new Set<number>(PLAN_DAYS_OPTIONS);
const MINUTE_SET = new Set<number>(PLAN_SESSION_MINUTES);
const FOCUS_SET = new Set<string>(PLAN_FOCUS);
const EQUIPMENT_SET = new Set<string>(PLAN_EQUIPMENT);
const STYLE_SET = new Set<string>(PLAN_STYLES);

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

export function focusLabel(focus: PlanFocus): string {
  const labels: Record<PlanFocus, string> = {
    full_body: "Full Body",
    chest: "Chest",
    back: "Back",
    legs: "Legs",
    shoulders: "Shoulders",
    arms: "Arms",
    core: "Core"
  };
  return labels[focus];
}

export function equipmentLabel(equipment: PlanEquipment): string {
  const labels: Record<PlanEquipment, string> = {
    none: "None",
    bands: "Bands",
    dumbbells: "Dumbbells",
    home_gym: "Home Gym",
    full_gym: "Full Gym"
  };
  return labels[equipment];
}

export function styleLabel(style: PlanStyle): string {
  const labels: Record<PlanStyle, string> = {
    strength: "Strength",
    hiit: "HIIT",
    yoga: "Yoga",
    pilates: "Pilates",
    walking: "Walking",
    jump_rope: "Jump Rope"
  };
  return labels[style];
}

/** Title-case / humanize plan field values for UI. */
export function humanizePlanLabel(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  if (GOAL_SET.has(raw)) {
    return goalLabel(raw as PlanGoal);
  }
  if (FOCUS_SET.has(raw)) {
    return focusLabel(raw as PlanFocus);
  }
  if (EQUIPMENT_SET.has(raw)) {
    return equipmentLabel(raw as PlanEquipment);
  }
  if (STYLE_SET.has(raw)) {
    return styleLabel(raw as PlanStyle);
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

  const focusRaw = (input.focus ?? DEFAULT_PLAN_FOCUS).trim() || DEFAULT_PLAN_FOCUS;
  const equipmentRaw =
    (input.equipment ?? DEFAULT_PLAN_EQUIPMENT).trim() || DEFAULT_PLAN_EQUIPMENT;
  const styleRaw = (input.style ?? DEFAULT_PLAN_STYLE).trim() || DEFAULT_PLAN_STYLE;
  if (
    !FOCUS_SET.has(focusRaw) ||
    !EQUIPMENT_SET.has(equipmentRaw) ||
    !STYLE_SET.has(styleRaw)
  ) {
    return null;
  }

  return {
    goal: goal as PlanGoal,
    experience: mapExperienceLevel(input.fitnessExperience),
    daysPerWeek: daysPerWeek as PlanDaysPerWeek,
    sessionMinutes: sessionMinutes as PlanSessionMinutes,
    focus: focusRaw as PlanFocus,
    equipment: equipmentRaw as PlanEquipment,
    style: styleRaw as PlanStyle
  };
}

export function cacheKeyFingerprint(key: WorkoutPlanCacheKey): string {
  return `${key.goal}|${key.experience}|${key.daysPerWeek}|${key.sessionMinutes}|${key.focus}|${key.equipment}|${key.style}`;
}

export type GeneratedPlanResult = {
  plan: WorkoutPlan;
  cached: boolean;
  source: "cache" | "ai" | "static";
};
