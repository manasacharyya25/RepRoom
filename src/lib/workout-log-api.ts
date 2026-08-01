import type { SupabaseClient } from "@supabase/supabase-js";
import { sendLobbyWorkoutLog } from "@/lib/lobby-chat-api";
import type { LobbyMessageView } from "@/lib/types/lobby-chat";
import type {
  CreateWorkoutLogInput,
  DbWorkoutDayCompletion,
  DbWorkoutLog,
  WorkoutDayCompletionView,
  WorkoutLogView
} from "@/lib/types/workout-log";
import { WORKOUT_DAY_COMPLETE_SECONDS } from "@/lib/types/workout-log";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function mapLog(row: DbWorkoutLog): WorkoutLogView {
  return {
    id: row.id,
    userId: row.user_id,
    loggedOn: row.logged_on,
    exerciseName: row.exercise_name,
    set: row.set_number,
    reps: row.reps,
    weight: row.weight,
    durationSeconds: row.duration_seconds,
    planDayIndex: row.plan_day_index,
    lobbyMessageId: row.lobby_message_id,
    createdAt: row.created_at
  };
}

function mapCompletion(row: DbWorkoutDayCompletion): WorkoutDayCompletionView {
  return {
    id: row.id,
    userId: row.user_id,
    loggedOn: row.logged_on,
    planDayIndex: row.plan_day_index,
    completedAt: row.completed_at
  };
}

export function normalizeCreateWorkoutLogInput(
  input: CreateWorkoutLogInput
): {
  exerciseName: string;
  set: number | null;
  reps: string | null;
  weight: string | null;
  durationSeconds: number | null;
  planDayIndex: number | null;
  loggedOn: string;
} {
  const exerciseName = String(input.exerciseName ?? "").trim();
  const loggedOn = String(input.loggedOn ?? "").trim();
  const planDayIndex =
    input.planDayIndex == null
      ? null
      : Math.round(Number(input.planDayIndex));

  const setRaw = input.set;
  let set: number | null = null;
  if (setRaw != null && String(setRaw).trim() !== "") {
    set = Math.round(Number(setRaw));
  }

  const repsRaw =
    input.reps == null ? "" : String(input.reps).trim();
  const reps = repsRaw || null;

  const weightRaw = input.weight == null ? "" : String(input.weight).trim();
  const weight = weightRaw || null;

  let durationSeconds: number | null = null;
  if (
    input.durationSeconds != null &&
    String(input.durationSeconds).trim() !== ""
  ) {
    durationSeconds = Math.round(Number(input.durationSeconds));
  }

  if (!exerciseName || exerciseName.length > 120) {
    throw new Error("Enter a valid exercise name.");
  }
  if (!DATE_RE.test(loggedOn)) {
    throw new Error("Invalid workout date.");
  }
  if (
    planDayIndex != null &&
    (!Number.isFinite(planDayIndex) || planDayIndex < 0)
  ) {
    throw new Error("Invalid plan day.");
  }

  if (set != null && (!Number.isFinite(set) || set < 1 || set > 100)) {
    throw new Error("Set number must be between 1 and 100.");
  }
  if (reps && reps.length > 40) {
    throw new Error("Reps value is too long.");
  }
  if (weight && weight.length > 40) {
    throw new Error("Weight is too long.");
  }
  if (
    durationSeconds != null &&
    (!Number.isFinite(durationSeconds) ||
      durationSeconds < 1 ||
      durationSeconds > 86400)
  ) {
    throw new Error("Enter a valid time for this set.");
  }

  if (set == null && !reps && !weight && durationSeconds == null) {
    throw new Error("Add set, reps, weight, or time.");
  }

  return {
    exerciseName,
    set,
    reps,
    weight,
    durationSeconds,
    planDayIndex,
    loggedOn
  };
}

export async function sumLoggedSecondsForDay(
  supabase: SupabaseClient,
  userId: string,
  loggedOn: string
): Promise<number> {
  const { data, error } = await supabase
    .from("workout_logs")
    .select("duration_seconds")
    .eq("user_id", userId)
    .eq("logged_on", loggedOn);

  if (error) throw error;
  return (data ?? []).reduce(
    (sum, row) => sum + Math.max(0, Number(row.duration_seconds) || 0),
    0
  );
}

export async function ensureDayCompletedIfEligible(
  supabase: SupabaseClient,
  userId: string,
  loggedOn: string,
  planDayIndex: number | null
): Promise<WorkoutDayCompletionView | null> {
  const total = await sumLoggedSecondsForDay(supabase, userId, loggedOn);
  if (total < WORKOUT_DAY_COMPLETE_SECONDS) return null;

  const { data, error } = await supabase
    .from("workout_day_completions")
    .upsert(
      {
        user_id: userId,
        logged_on: loggedOn,
        plan_day_index: planDayIndex
      },
      { onConflict: "user_id,logged_on" }
    )
    .select("id, user_id, logged_on, plan_day_index, completed_at")
    .single();

  if (error) throw error;
  return mapCompletion(data as DbWorkoutDayCompletion);
}

export async function listWorkoutDayCompletions(
  supabase: SupabaseClient,
  userId: string,
  options?: { from?: string; to?: string }
): Promise<WorkoutDayCompletionView[]> {
  let query = supabase
    .from("workout_day_completions")
    .select("id, user_id, logged_on, plan_day_index, completed_at")
    .eq("user_id", userId)
    .order("logged_on", { ascending: true });

  if (options?.from) query = query.gte("logged_on", options.from);
  if (options?.to) query = query.lte("logged_on", options.to);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as DbWorkoutDayCompletion[]).map(mapCompletion);
}

export async function createWorkoutLog(
  supabase: SupabaseClient,
  userId: string,
  input: CreateWorkoutLogInput
): Promise<{
  log: WorkoutLogView;
  message: LobbyMessageView;
  dayCompleted: boolean;
  completion: WorkoutDayCompletionView | null;
}> {
  const normalized = normalizeCreateWorkoutLogInput(input);
  const payload = {
    exerciseName: normalized.exerciseName,
    set: normalized.set,
    reps: normalized.reps,
    weight: normalized.weight,
    durationSeconds: normalized.durationSeconds,
    planDayIndex: normalized.planDayIndex,
    loggedOn: normalized.loggedOn
  };

  const message = await sendLobbyWorkoutLog(supabase, userId, payload);

  const { data, error } = await supabase
    .from("workout_logs")
    .insert({
      user_id: userId,
      logged_on: normalized.loggedOn,
      exercise_name: normalized.exerciseName,
      set_number: normalized.set,
      reps: normalized.reps,
      weight: normalized.weight,
      duration_seconds: normalized.durationSeconds,
      plan_day_index: normalized.planDayIndex,
      lobby_message_id: message.id
    })
    .select(
      "id, user_id, logged_on, exercise_name, set_number, reps, weight, duration_seconds, plan_day_index, lobby_message_id, created_at"
    )
    .single();

  if (error) throw error;

  const completion = await ensureDayCompletedIfEligible(
    supabase,
    userId,
    normalized.loggedOn,
    normalized.planDayIndex
  );

  return {
    log: mapLog(data as DbWorkoutLog),
    message,
    dayCompleted: Boolean(completion),
    completion
  };
}
