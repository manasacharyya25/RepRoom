import {
  exerciseCount,
  isAddOnActivity,
  sessionDurationMinutes,
  type WorkoutPlan,
  type WorkoutPlanDay
} from "@/lib/workout-plan";

export type WeekDayStatus = "upcoming" | "missed" | "rest" | "completed";

export type WeekDaySlot = {
  date: Date;
  dateKey: string;
  weekday: string;
  dateLabel: string;
  /** First main exercise name (or day title fallback). */
  label: string | null;
  /** Plan day title, e.g. "Push" / "Full Body A". */
  sessionTitle: string | null;
  /** Index into plan.days when this is a workout day. */
  sessionIndex: number | null;
  isRest: boolean;
  isToday: boolean;
  status: WeekDayStatus;
  exerciseCount: number;
  durationMinutes: number;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Weekday indexes (Mon=0 … Sun=6) for N sessions/week.
 * Always starts Monday; rest days are spaced between workouts.
 */
const SESSION_SLOT_PATTERNS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 2, 4, 5],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6]
};

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Monday-start week containing `anchor`. */
export function startOfWeekMonday(anchor: Date): Date {
  const day = startOfLocalDay(anchor);
  const weekday = day.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + offset);
  return day;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const startLabel = weekStart.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
  const endLabel = weekEnd.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric"
  });
  return `${startLabel} – ${endLabel}`;
}

export function weekRelativeLabel(weekStart: Date, today = new Date()): string {
  const thisWeek = startOfWeekMonday(today);
  const diffDays = Math.round(
    (weekStart.getTime() - thisWeek.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays === 0) return "This Week";
  if (diffDays === 7) return "Next Week";
  if (diffDays === -7) return "Last Week";
  return formatWeekRange(weekStart);
}

export function formatDurationHours(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** First non–ADD-ON exercise name for the weekly calendar row. */
export function firstExerciseName(day: WorkoutPlanDay): string | null {
  const exercise = day.activities.find(
    (item) => item.type === "exercise" && !isAddOnActivity(item)
  );
  return exercise?.name?.trim() || null;
}

export function resolveSessionLabel(
  day: WorkoutPlanDay,
  _index: number,
  _plan: WorkoutPlan
): string {
  return firstExerciseName(day) ?? day.title;
}

function slotIndexesForPlan(plan: WorkoutPlan): number[] {
  const count = Math.min(
    7,
    Math.max(1, plan.days.length || plan.sessionsPerWeek || 3)
  );
  return SESSION_SLOT_PATTERNS[count] ?? SESSION_SLOT_PATTERNS[3];
}

/**
 * Build Mon–Sun slots for a week from a stored workout plan.
 * Session 1 → Monday, then remaining sessions follow SESSION_SLOT_PATTERNS
 * so rest days sit between workouts based on sessionsPerWeek.
 * Without completion persistence: past rest days count as Completed,
 * past workouts as Missed, future workouts Upcoming, future rest Rest Day.
 */
export function buildWeekDaySlots(
  plan: WorkoutPlan,
  weekStart: Date,
  today = new Date()
): WeekDaySlot[] {
  const todayKey = dateKey(startOfLocalDay(today));
  const slots = slotIndexesForPlan(plan);
  const byWeekday = new Map<
    number,
    {
      label: string;
      sessionTitle: string;
      sessionIndex: number;
      exerciseCount: number;
    }
  >();

  slots.forEach((weekdayIndex, sessionIndex) => {
    const day = plan.days[sessionIndex];
    if (!day) return;
    byWeekday.set(weekdayIndex, {
      label: resolveSessionLabel(day, sessionIndex, plan),
      sessionTitle: day.title,
      sessionIndex,
      exerciseCount: exerciseCount(day)
    });
  });

  const durationMinutes = sessionDurationMinutes(plan);

  return WEEKDAYS.map((weekday, index) => {
    const date = addDays(weekStart, index);
    const key = dateKey(date);
    const scheduled = byWeekday.get(index) ?? null;
    const isToday = key === todayKey;
    const isRest = !scheduled;
    const isPast = key < todayKey;

    let status: WeekDayStatus = "rest";
    if (isRest) {
      status = isPast ? "completed" : "rest";
    } else if (isPast) {
      status = "missed";
    } else {
      status = "upcoming";
    }

    return {
      date,
      dateKey: key,
      weekday,
      dateLabel: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      }),
      label: scheduled?.label ?? null,
      sessionTitle: scheduled?.sessionTitle ?? null,
      sessionIndex: scheduled?.sessionIndex ?? null,
      isRest,
      isToday,
      status,
      exerciseCount: scheduled?.exerciseCount ?? 0,
      durationMinutes: scheduled ? durationMinutes : 0
    };
  });
}

export function statusLabel(status: WeekDayStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "missed":
      return "Missed";
    case "upcoming":
      return "Upcoming";
    case "rest":
      return "Rest Day";
  }
}

export function weekPlanStats(slots: WeekDaySlot[]): {
  completed: number;
  total: number;
  plannedMinutes: number;
} {
  return {
    completed: slots.filter((slot) => slot.status === "completed").length,
    total: slots.length,
    plannedMinutes: slots.reduce((sum, slot) => sum + slot.durationMinutes, 0)
  };
}
