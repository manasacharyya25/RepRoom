export type WorkoutLogPayload = {
  exerciseName: string;
  set: number | null;
  reps: string | null;
  weight: string | null;
  durationSeconds: number | null;
  planDayIndex: number | null;
  loggedOn: string;
};

export type CreateWorkoutLogInput = {
  exerciseName: string;
  set?: number | null;
  reps?: string | number | null;
  weight?: string | null;
  durationSeconds?: number | null;
  planDayIndex?: number | null;
  loggedOn: string;
};

export type DbWorkoutLog = {
  id: string;
  user_id: string;
  logged_on: string;
  exercise_name: string;
  set_number: number | null;
  reps: string | null;
  weight: string | null;
  duration_seconds: number | null;
  plan_day_index: number | null;
  lobby_message_id: string | null;
  created_at: string;
};

export type WorkoutLogView = {
  id: string;
  userId: string;
  loggedOn: string;
  exerciseName: string;
  set: number | null;
  reps: string | null;
  weight: string | null;
  durationSeconds: number | null;
  planDayIndex: number | null;
  lobbyMessageId: string | null;
  createdAt: string;
};

export type DbWorkoutDayCompletion = {
  id: string;
  user_id: string;
  logged_on: string;
  plan_day_index: number | null;
  completed_at: string;
};

export type WorkoutDayCompletionView = {
  id: string;
  userId: string;
  loggedOn: string;
  planDayIndex: number | null;
  completedAt: string;
};

/** Minimum logged duration in a calendar day to mark the plan day completed. */
export const WORKOUT_DAY_COMPLETE_SECONDS = 15 * 60;
