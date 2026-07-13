import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadAvatar } from "@/lib/avatar";
import {
  goalProgress,
  hoursGoalTarget,
  slugifyUsername,
  stripCacheBust
} from "@/lib/goals";
import type {
  OnboardingGoalInput,
  OnboardingPayload
} from "@/lib/types/profile";

function buildDefaultGoals(payload: OnboardingPayload): OnboardingGoalInput[] {
  if (payload.goals.length > 0) return payload.goals;

  const currentWeight = payload.currentWeightKg ?? 0;
  const targetWeight = payload.targetWeightKg ?? currentWeight;
  const hoursTarget = hoursGoalTarget(0);

  return [
    {
      template_id: "train_weekly",
      title: "Train 5 days a week",
      detail: "Consistency over perfection",
      category: "consistency",
      current_value: 0,
      target_value: 5,
      unit: "days",
      sort_order: 0
    },
    {
      template_id: "mobility_streak",
      title: "Morning mobility streak",
      detail: "Build a daily habit",
      category: "consistency",
      current_value: 0,
      target_value: 30,
      unit: "days",
      sort_order: 1
    },
    {
      template_id: "hours_worked",
      title: "Hours worked",
      detail: "Time in live rooms",
      category: "consistency",
      current_value: 0,
      target_value: hoursTarget,
      unit: "hours",
      sort_order: 2
    },
    {
      template_id: "target_weight",
      title: "Hit target weight",
      detail: "Track toward your goal weight",
      category: "lifestyle",
      current_value: currentWeight,
      target_value: targetWeight || 50,
      unit: "kg",
      sort_order: 3
    }
  ];
}

export async function completeOnboarding(
  supabase: SupabaseClient,
  payload: OnboardingPayload
) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("You must be signed in to finish onboarding.");

  let avatarUrl = payload.avatarUrl
    ? stripCacheBust(payload.avatarUrl)
    : null;

  if (payload.avatarFile) {
    avatarUrl = await uploadAvatar(supabase, user.id, payload.avatarFile);
  } else if (avatarUrl?.startsWith("blob:")) {
    avatarUrl = null;
  }

  const handle =
    slugifyUsername(payload.username) ||
    slugifyUsername(payload.displayName) ||
    slugifyUsername(user.email?.split("@")[0] ?? "athlete") ||
    `user_${user.id.slice(0, 8)}`;

  const displayName =
    payload.displayName.trim() ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Athlete";

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
      username: handle,
      bio: payload.bio.trim() || null,
      avatar_url: avatarUrl,
      age_range: payload.ageRange || null,
      country_code: payload.countryCode || null,
      timezone: payload.timezone || null,
      height_cm: payload.heightCm,
      current_weight_kg: payload.currentWeightKg,
      weight_unit: payload.weightUnit,
      onboarding_completed_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (profileError) throw profileError;

  const goals = buildDefaultGoals(payload);

  // Always include hours_worked
  if (!goals.some((goal) => goal.template_id === "hours_worked")) {
    goals.push({
      template_id: "hours_worked",
      title: "Hours worked",
      detail: "Time in live rooms",
      category: "consistency",
      current_value: 0,
      target_value: hoursGoalTarget(0),
      unit: "hours",
      sort_order: goals.length
    });
  }

  // Always include target_weight when we have numbers
  if (
    payload.currentWeightKg != null &&
    payload.targetWeightKg != null &&
    !goals.some((goal) => goal.template_id === "target_weight")
  ) {
    goals.push({
      template_id: "target_weight",
      title: "Hit target weight",
      detail: "Track toward your goal weight",
      category: "lifestyle",
      current_value: payload.currentWeightKg,
      target_value: payload.targetWeightKg,
      unit: "kg",
      sort_order: goals.length
    });
  }

  const rows = goals.map((goal) => ({
    user_id: user.id,
    template_id: goal.template_id,
    title: goal.title,
    detail: goal.detail,
    category: goal.category,
    current_value: goal.current_value,
    target_value: goal.target_value,
    unit: goal.unit,
    progress: goalProgress(goal.current_value, goal.target_value),
    sort_order: goal.sort_order
  }));

  const { error: deleteError } = await supabase
    .from("goals")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) throw deleteError;

  const { error: goalsError } = await supabase.from("goals").insert(rows);
  if (goalsError) throw goalsError;

  return { userId: user.id };
}

/** Add live session duration (hours) to the hours_worked goal. */
export async function addLiveHours(
  supabase: SupabaseClient,
  hoursToAdd: number
) {
  if (!Number.isFinite(hoursToAdd) || hoursToAdd <= 0) return;

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return;

  const { data: existing, error: readError } = await supabase
    .from("goals")
    .select("id, current_value, target_value")
    .eq("user_id", user.id)
    .eq("template_id", "hours_worked")
    .maybeSingle();

  if (readError) throw readError;

  const current = Number(existing?.current_value ?? 0) + hoursToAdd;
  const target = hoursGoalTarget(current);
  const progress = goalProgress(current, target);

  if (existing) {
    const { error } = await supabase
      .from("goals")
      .update({
        current_value: current,
        target_value: target,
        progress
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    template_id: "hours_worked",
    title: "Hours worked",
    detail: "Time in live rooms",
    category: "consistency",
    current_value: current,
    target_value: target,
    unit: "hours",
    progress,
    sort_order: 0
  });

  if (error) throw error;
}
