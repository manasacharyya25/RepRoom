import type { WorkoutPlan } from "@/lib/workout-plan";

export const FREE_PLAN_DRAFT_KEY = "rhoq_free_plan_draft_v2";

export type FreePlanLifestyle = {
  ageRange?: string;
  gender?: string;
  activityLevel?: string;
  heightUnit?: "imperial" | "metric";
  heightFeet?: string;
  heightInches?: string;
  heightCm?: string;
  weightUnit?: "kg" | "lbs";
  currentWeight?: string;
  eatingHabits?: string;
  mealsPerDay?: string;
  sleepHours?: string;
  sleepQuality?: string;
  skipReason?: string;
  motivation?: string;
  workoutWhen?: string;
  workoutWhere?: string;
  workoutEnjoy?: string;
};

export type FreePlanDraft = {
  primaryGoal: string;
  fitnessExperience: string;
  daysPerWeek: number;
  sessionMinutes: number;
  focus: string;
  equipment: string;
  style: string;
  plan: WorkoutPlan;
  lifestyle?: FreePlanLifestyle;
  savedAt: string;
};

export function readFreePlanDraft(): FreePlanDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FREE_PLAN_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FreePlanDraft;
    if (!parsed?.plan || !parsed.primaryGoal) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveFreePlanDraft(draft: FreePlanDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    FREE_PLAN_DRAFT_KEY,
    JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
  );
}

export function clearFreePlanDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(FREE_PLAN_DRAFT_KEY);
}
