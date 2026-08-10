import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_IMAGES } from "@/lib/live-images";
import { sendLobbyWorkoutLog } from "@/lib/lobby-chat-api";
import type { LobbyMessageView } from "@/lib/types/lobby-chat";
import type {
  CreateWorkoutLogInput,
  DbWorkoutDayCompletion,
  DbWorkoutLog,
  WorkoutDayCompletionView,
  WorkoutLogCommentAuthor,
  WorkoutLogCommentRow,
  WorkoutLogCommentView,
  WorkoutLogView
} from "@/lib/types/workout-log";
import {
  WORKOUT_DAY_COMPLETE_SECONDS,
  WORKOUT_LOG_COMMENT_MAX_LENGTH,
  WORKOUT_LOGS_PAGE_SIZE
} from "@/lib/types/workout-log";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const WORKOUT_LOG_SELECT =
  "id, user_id, logged_on, exercise_name, set_number, reps, weight, duration_seconds, plan_day_index, lobby_message_id, likes_count, comments_count, created_at";

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
    likesCount: Number(row.likes_count ?? 0),
    commentsCount: Number(row.comments_count ?? 0),
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
    .select(WORKOUT_LOG_SELECT)
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

export type ListUserWorkoutLogsPage = {
  logs: WorkoutLogView[];
  hasMore: boolean;
  likedLogIds: string[];
};

async function fetchLikedWorkoutLogIds(
  supabase: SupabaseClient,
  userId: string,
  logIds: string[]
): Promise<string[]> {
  if (logIds.length === 0) return [];
  const { data, error } = await supabase
    .from("workout_log_likes")
    .select("workout_log_id")
    .eq("user_id", userId)
    .in("workout_log_id", logIds);
  if (error) throw error;
  return (data ?? []).map((row) => row.workout_log_id as string);
}

export async function listUserWorkoutLogs(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    limit?: number;
    /** ISO created_at cursor — fetch rows older than this. */
    before?: string | null;
  }
): Promise<ListUserWorkoutLogsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? WORKOUT_LOGS_PAGE_SIZE),
    WORKOUT_LOGS_PAGE_SIZE
  );
  const fetchLimit = limit + 1;

  let query = supabase
    .from("workout_logs")
    .select(WORKOUT_LOG_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (options?.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbWorkoutLog[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const logs = pageRows.map(mapLog);

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const likedLogIds = user
    ? await fetchLikedWorkoutLogIds(
        supabase,
        user.id,
        logs.map((log) => log.id)
      )
    : [];

  return { logs, hasMore, likedLogIds };
}

export async function toggleWorkoutLogLike(
  supabase: SupabaseClient,
  workoutLogId: string,
  currentlyLiked: boolean
): Promise<{ liked: boolean; likesCount: number }> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to like workout logs.");

  if (currentlyLiked) {
    const { error } = await supabase
      .from("workout_log_likes")
      .delete()
      .eq("workout_log_id", workoutLogId)
      .eq("user_id", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("workout_log_likes").insert({
      workout_log_id: workoutLogId,
      user_id: user.id
    });
    if (error) throw error;
  }

  const { data: log, error: logError } = await supabase
    .from("workout_logs")
    .select("likes_count")
    .eq("id", workoutLogId)
    .single();
  if (logError) throw logError;

  return {
    liked: !currentlyLiked,
    likesCount: Number(log?.likes_count ?? 0)
  };
}

function normalizeCommentAuthor(
  profiles: WorkoutLogCommentRow["profiles"]
): WorkoutLogCommentAuthor | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
}

export function mapWorkoutLogCommentRow(
  row: WorkoutLogCommentRow
): WorkoutLogCommentView {
  const profile = normalizeCommentAuthor(row.profiles);
  return {
    id: row.id,
    workoutLogId: row.workout_log_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    author: profile?.display_name?.trim() || "Athlete",
    handle: profile?.username ? `@${profile.username}` : "@athlete",
    avatar: profile?.avatar_url?.trim() || LIVE_IMAGES.participant4
  };
}

export async function listWorkoutLogComments(
  supabase: SupabaseClient,
  workoutLogId: string
): Promise<WorkoutLogCommentView[]> {
  const { data, error } = await supabase
    .from("workout_log_comments")
    .select(
      `
      *,
      profiles (
        display_name,
        username,
        avatar_url
      )
    `
    )
    .eq("workout_log_id", workoutLogId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as WorkoutLogCommentRow[]).map(mapWorkoutLogCommentRow);
}

export async function createWorkoutLogComment(
  supabase: SupabaseClient,
  workoutLogId: string,
  body: string
): Promise<{ comment: WorkoutLogCommentView; commentsCount: number }> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment cannot be empty.");
  if (trimmed.length > WORKOUT_LOG_COMMENT_MAX_LENGTH) {
    throw new Error("Comment is too long.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to comment.");

  const { data, error } = await supabase
    .from("workout_log_comments")
    .insert({
      workout_log_id: workoutLogId,
      user_id: user.id,
      body: trimmed
    })
    .select(
      `
      *,
      profiles (
        display_name,
        username,
        avatar_url
      )
    `
    )
    .single();

  if (error) throw error;

  const { data: log, error: logError } = await supabase
    .from("workout_logs")
    .select("comments_count")
    .eq("id", workoutLogId)
    .single();
  if (logError) throw logError;

  return {
    comment: mapWorkoutLogCommentRow(data as WorkoutLogCommentRow),
    commentsCount: Number(log?.comments_count ?? 0)
  };
}
