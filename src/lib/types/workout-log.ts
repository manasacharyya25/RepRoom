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
  likes_count: number;
  comments_count: number;
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
  likesCount: number;
  commentsCount: number;
  createdAt: string;
};

export type DbWorkoutLogComment = {
  id: string;
  workout_log_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type WorkoutLogCommentAuthor = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type WorkoutLogCommentRow = DbWorkoutLogComment & {
  profiles: WorkoutLogCommentAuthor | WorkoutLogCommentAuthor[] | null;
};

export type WorkoutLogCommentView = {
  id: string;
  workoutLogId: string;
  userId: string;
  body: string;
  createdAt: string;
  author: string;
  handle: string;
  avatar: string;
};

export const WORKOUT_LOG_COMMENT_MAX_LENGTH = 500;
export const WORKOUT_LOGS_PAGE_SIZE = 20;

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
