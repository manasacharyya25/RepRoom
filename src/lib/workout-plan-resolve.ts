import {
  getCachedWorkoutPlan,
  saveCachedWorkoutPlan
} from "@/lib/workout-plan-cache";
import { generateWorkoutPlanWithAi } from "@/lib/workout-plan-ai";
import {
  buildStaticWorkoutPlan,
  scalePlanToSessionDuration,
  withPlanSource,
  type WorkoutPlan
} from "@/lib/workout-plan";
import {
  normalizePlanCacheKey,
  type GeneratedPlanResult,
  type WorkoutPlanGenerateInput
} from "@/lib/workout-plan-seed";

/**
 * Resolve a workout plan for an onboarding combination.
 * Cache hit → return immediately (no LLM).
 * Cache miss → generate with AI, store, return.
 * If AI unavailable/fails → static fallback (not cached).
 */
export async function resolveWorkoutPlan(
  input: WorkoutPlanGenerateInput
): Promise<GeneratedPlanResult | { error: string }> {
  const key = normalizePlanCacheKey(input);
  if (!key) {
    return {
      error:
        "Invalid plan inputs. Check goal, experience, days per week, and session length."
    };
  }

  const cached = await getCachedWorkoutPlan(key);
  if (cached?.plan) {
    return {
      plan: withPlanSource(scalePlanToSessionDuration(cached.plan), "cache"),
      cached: true,
      source: "cache"
    };
  }

  const generated = await generateWorkoutPlanWithAi(key);
  if (generated) {
    await saveCachedWorkoutPlan(key, generated.plan, generated.model);
    return {
      plan: withPlanSource(generated.plan, "ai"),
      cached: false,
      source: "ai"
    };
  }

  const fallback: WorkoutPlan = withPlanSource(
    scalePlanToSessionDuration(
      buildStaticWorkoutPlan({
        primaryGoal: key.goal,
        experience:
          key.experience === "advanced"
            ? "3_plus_years"
            : key.experience === "intermediate"
              ? "1_3_years"
              : "just_starting",
        daysPerWeek: key.daysPerWeek,
        sessionMinutes: key.sessionMinutes,
        focus: key.focus,
        equipment: key.equipment,
        style: key.style
      })
    ),
    "static"
  );

  return {
    plan: fallback,
    cached: false,
    source: "static"
  };
}
