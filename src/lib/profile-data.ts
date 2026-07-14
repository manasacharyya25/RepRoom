import { createClient } from "@/lib/supabase/server";
import { hoursGoalTarget } from "@/lib/goals";
import { resolveGoalProgress } from "@/lib/profile-format";
import type { Goal, Profile, ProfileViewModel } from "@/lib/types/profile";

export type { ProfileViewModel };

function toProfileView(
  profile: Profile,
  goals: Goal[]
): ProfileViewModel {
  const typedGoals = goals;
  const hoursGoalRow = typedGoals.find(
    (goal) => goal.template_id === "hours_worked"
  );
  const streakGoal = typedGoals.find(
    (goal) => goal.template_id === "mobility_streak"
  );

  const hoursWorked = Number(hoursGoalRow?.current_value ?? 0);
  const hoursGoal = Number(
    hoursGoalRow?.target_value ?? hoursGoalTarget(hoursWorked)
  );
  const hoursProgress = resolveGoalProgress(
    hoursGoalRow ?? {
      id: "hours",
      user_id: profile.id,
      template_id: "hours_worked",
      title: "Hours worked",
      detail: null,
      category: "consistency",
      current_value: hoursWorked,
      target_value: hoursGoal,
      unit: "hours",
      progress: 0,
      sort_order: 0,
      created_at: "",
      updated_at: ""
    }
  );

  return {
    profile,
    goals: typedGoals,
    hoursWorked,
    hoursGoal,
    hoursProgress,
    dayStreak: Math.round(Number(streakGoal?.current_value ?? 0))
  };
}

export async function getCurrentProfileView(): Promise<ProfileViewModel | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: goals }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
  ]);

  if (!profile) return null;

  return toProfileView(profile as Profile, (goals ?? []) as Goal[]);
}

export async function getProfileViewByUsername(
  username: string
): Promise<ProfileViewModel | null> {
  const handle = username.trim().toLowerCase();
  if (!handle) return null;

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", handle)
    .maybeSingle();

  if (error) throw error;
  if (!profile) return null;

  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", profile.id)
    .order("sort_order", { ascending: true });

  return toProfileView(profile as Profile, (goals ?? []) as Goal[]);
}
