import type { FreePlanLifestyle } from "@/lib/free-plan-draft";
import type { OnboardingGoalInput, WeightUnit } from "@/lib/types/profile";
import type { WorkoutPlan, WorkoutPlanStatus } from "@/lib/workout-plan";
import { heightToCm, hoursGoalTarget, toKg } from "@/lib/goals";

/** Convert /plan personal-info answers onto onboarding profile fields. */
export function personalFromFreePlanLifestyle(
  life: FreePlanLifestyle | undefined | null
) {
  if (!life) {
    return {
      ageRange: "",
      gender: "",
      activityLevel: "",
      heightCm: null as number | null,
      currentWeightKg: null as number | null,
      weightUnit: "kg" as WeightUnit
    };
  }

  const height = heightToCm({
    unit: life.heightUnit ?? "imperial",
    feet: Number.parseFloat(life.heightFeet ?? "") || 0,
    inches: Number.parseFloat(life.heightInches ?? "") || 0,
    cm: Number.parseFloat(life.heightCm ?? "") || 0
  });
  const weightNowRaw = Number.parseFloat(life.currentWeight ?? "");

  return {
    ageRange: life.ageRange ?? "",
    gender: life.gender ?? "",
    activityLevel: life.activityLevel ?? "",
    heightCm: Number.isFinite(height) && height > 0 ? height : null,
    currentWeightKg: Number.isFinite(weightNowRaw)
      ? toKg(weightNowRaw, life.weightUnit ?? "kg")
      : null,
    weightUnit: (life.weightUnit ?? "kg") as WeightUnit
  };
}

const DRAFT_KEY = "rhoq_onboarding_draft_v1";

export type OnboardingPlanQuizAnswers = {
  focus: string;
  style: string;
  equipment: string;
  eatingHabits: string;
  mealsPerDay: string;
  sleepHours: string;
  sleepQuality: string;
  skipReason: string;
  motivation: string;
  workoutWhen: string;
  workoutWhere: string;
  workoutEnjoy: string;
};

export type OnboardingDraft = {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
  ageRange: string;
  gender: string;
  activityLevel: string;
  fitnessExperience: string;
  heightCm: number | null;
  currentWeightKg: number | null;
  weightUnit: WeightUnit;
  primaryFitnessGoal: string;
  workoutDaysPerWeek: number | null;
  sessionMinutes: number | null;
  successMilestone: string;
  workoutPlanStatus: WorkoutPlanStatus;
  workoutPlan: WorkoutPlan | null;
  goals: OnboardingGoalInput[];
  fromPlan?: boolean;
  planQuiz?: OnboardingPlanQuizAnswers;
};

export function buildOnboardingGoalsFromDraft(options: {
  primaryFitnessGoal: string;
  workoutDaysPerWeek: number | null;
  sessionMinutes: number | null;
  successMilestone: string;
}): OnboardingGoalInput[] {
  const days = options.workoutDaysPerWeek ?? 5;
  const minutes = options.sessionMinutes ?? 45;
  const primaryTitles: Record<string, string> = {
    build_muscle: "Build muscle",
    lose_fat: "Lose fat",
    get_stronger: "Get stronger",
    improve_endurance: "Improve endurance",
    more_flexible: "Become more flexible",
    stay_healthy: "Stay healthy & active",
    stay_consistent: "Stay consistent"
  };
  const primary =
    primaryTitles[options.primaryFitnessGoal] ?? "Stay healthy & active";
  const milestone = options.successMilestone.trim() || "Just keep showing up";
  const hoursTarget = hoursGoalTarget(0);

  return [
    {
      template_id: "primary_fitness",
      title: primary,
      detail: "Primary fitness goal",
      category: "lifestyle",
      current_value: 0,
      target_value: 1,
      unit: "goal",
      sort_order: 0
    },
    {
      template_id: "train_weekly",
      title: `Train ${days} days a week`,
      detail: "Weekly workout frequency",
      category: "consistency",
      current_value: 0,
      target_value: days,
      unit: "days",
      sort_order: 1
    },
    {
      template_id: "session_length",
      title: `${minutes}+ min sessions`,
      detail: "Time you can commit per session",
      category: "consistency",
      current_value: 0,
      target_value: minutes,
      unit: "min",
      sort_order: 2
    },
    {
      template_id: "success_milestone",
      title: milestone,
      detail: "Milestone that would feel successful",
      category: "performance",
      current_value: 0,
      target_value: 1,
      unit: "milestone",
      sort_order: 3
    },
    {
      template_id: "hours_worked",
      title: "Hours worked",
      detail: "Time in live rooms",
      category: "consistency",
      current_value: 0,
      target_value: hoursTarget,
      unit: "hours",
      sort_order: 4
    }
  ];
}

export function saveOnboardingDraft(draft: OnboardingDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function readOnboardingDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    return null;
  }
}

export function clearOnboardingDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DRAFT_KEY);
}
