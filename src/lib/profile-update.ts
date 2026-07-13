import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadAvatar } from "@/lib/avatar";
import { goalProgress, hoursGoalTarget, slugifyUsername, stripCacheBust } from "@/lib/goals";
import type { Goal, Profile } from "@/lib/types/profile";

export type EditableGoalInput = {
  id: string;
  template_id: string;
  title: string;
  current_value: number;
  target_value: number;
  unit: string | null;
};

export type UpdateProfileInput = {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  avatarFile: File | null;
  goals: EditableGoalInput[];
};

function directedProgress(
  templateId: string,
  current: number,
  target: number
): number {
  const minimize =
    templateId === "target_weight" ||
    (templateId === "meal_prep" && current > target);

  if (minimize) {
    if (current <= target) return 100;
    // Above target without a stored baseline → not complete yet
    return 0;
  }

  if (templateId === "hours_worked") {
    const nextTarget = hoursGoalTarget(current);
    return goalProgress(current, nextTarget);
  }

  return goalProgress(current, target);
}

export async function updateProfileAndGoals(
  supabase: SupabaseClient,
  input: UpdateProfileInput
): Promise<{ profile: Profile; goals: Goal[] }> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("You must be signed in to edit your profile.");

  const handle = slugifyUsername(input.username);
  if (!handle || handle.length < 3) {
    throw new Error("Username needs at least 3 characters.");
  }

  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new Error("Display name is required.");
  }

  let avatarUrl = input.avatarUrl ? stripCacheBust(input.avatarUrl) : null;
  if (input.avatarFile) {
    avatarUrl = await uploadAvatar(supabase, user.id, input.avatarFile);
  } else if (avatarUrl?.startsWith("blob:")) {
    avatarUrl = null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username: handle,
      bio: input.bio.trim() || null,
      avatar_url: avatarUrl
    })
    .eq("id", user.id)
    .select("*")
    .single();

  if (profileError) {
    if (
      profileError.message.includes("duplicate") ||
      profileError.message.includes("username")
    ) {
      throw new Error("That username is taken. Try another.");
    }
    throw profileError;
  }

  for (const goal of input.goals) {
    let current = goal.current_value;
    let target = goal.target_value;

    if (goal.template_id === "hours_worked") {
      target = hoursGoalTarget(current);
    }

    const progress = directedProgress(goal.template_id, current, target);

    const { error: goalError } = await supabase
      .from("goals")
      .update({
        title: goal.title.trim() || goal.title,
        current_value: current,
        target_value: target,
        progress
      })
      .eq("id", goal.id)
      .eq("user_id", user.id);

    if (goalError) throw goalError;
  }

  const { data: goals, error: goalsReadError } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (goalsReadError) throw goalsReadError;

  return {
    profile: profile as Profile,
    goals: (goals ?? []) as Goal[]
  };
}
