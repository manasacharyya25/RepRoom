import {
  createAdminClient,
  isAdminConfigured
} from "@/lib/supabase/admin";
import type { WorkoutPlan } from "@/lib/workout-plan";
import type { WorkoutPlanCacheKey } from "@/lib/workout-plan-seed";

type TemplateRow = {
  plan: WorkoutPlan;
  model: string | null;
};

export async function getCachedWorkoutPlan(
  key: WorkoutPlanCacheKey
): Promise<TemplateRow | null> {
  if (!isAdminConfigured()) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workout_plan_templates")
    .select("plan, model")
    .eq("goal", key.goal)
    .eq("experience", key.experience)
    .eq("days_per_week", key.daysPerWeek)
    .eq("session_minutes", key.sessionMinutes)
    .eq("focus", key.focus)
    .eq("equipment", key.equipment)
    .eq("style", key.style)
    .maybeSingle();

  if (error) {
    console.error("[workout-plan-cache] lookup failed", error.message);
    return null;
  }
  if (!data?.plan) return null;

  return {
    plan: data.plan as WorkoutPlan,
    model: data.model
  };
}

export async function saveCachedWorkoutPlan(
  key: WorkoutPlanCacheKey,
  plan: WorkoutPlan,
  model: string | null
): Promise<void> {
  if (!isAdminConfigured()) return;

  const admin = createAdminClient();
  const { error } = await admin.from("workout_plan_templates").upsert(
    {
      goal: key.goal,
      experience: key.experience,
      days_per_week: key.daysPerWeek,
      session_minutes: key.sessionMinutes,
      focus: key.focus,
      equipment: key.equipment,
      style: key.style,
      plan,
      model,
      updated_at: new Date().toISOString()
    },
    {
      onConflict:
        "goal,experience,days_per_week,session_minutes,focus,equipment,style"
    }
  );

  if (error) {
    console.error("[workout-plan-cache] save failed", error.message);
  }
}
