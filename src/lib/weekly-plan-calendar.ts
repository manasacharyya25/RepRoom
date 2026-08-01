import type { WorkoutPlan, WorkoutPlanSession } from "@/lib/workout-plan";

export type WeekDayStatus = "upcoming" | "missed" | "rest" | "completed";

export type WeekDaySlot = {
  date: Date;
  dateKey: string;
  weekday: string;
  dateLabel: string;
  label: string | null;
  isRest: boolean;
  isToday: boolean;
  status: WeekDayStatus;
  exerciseCount: number;
  durationMinutes: number;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const SESSION_SLOT_PATTERNS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5]
};

const FALLBACK_LABELS = [
  "Upper Body",
  "Lower Body",
  "Pull",
  "Push",
  "Full Body",
  "Cardio"
];

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

function sessionLabel(
  session: WorkoutPlanSession,
  index: number,
  plan: WorkoutPlan
): string {
  if (!/^workout\s+[a-z]$/i.test(session.day.trim())) {
    return session.day;
  }

  if (/cardio/i.test(plan.split) && index % 2 === 0) {
    return index === 0 ? "Cardio + Strength" : "Cardio";
  }

  if (/strength/i.test(plan.workoutStyle)) {
    const strengthLabels = [
      "Upper Body",
      "Lower Body",
      "Full Body",
      "Push",
      "Pull",
      "Legs"
    ];
    return strengthLabels[index] ?? FALLBACK_LABELS[index] ?? session.day;
  }

  return FALLBACK_LABELS[index] ?? session.day;
}

export function resolveSessionLabel(
  session: WorkoutPlanSession,
  index: number,
  plan: WorkoutPlan
): string {
  return sessionLabel(session, index, plan);
}

function slotIndexesForPlan(plan: WorkoutPlan): number[] {
  const count = Math.min(
    6,
    Math.max(1, plan.weeklySchedule.length || plan.sessionsPerWeek || 3)
  );
  return SESSION_SLOT_PATTERNS[count] ?? SESSION_SLOT_PATTERNS[3];
}

/**
 * Build Mon–Sun slots for a week from a stored workout plan.
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
  const byWeekday = new Map<number, { label: string; exerciseCount: number }>();

  slots.forEach((weekdayIndex, sessionIndex) => {
    const session = plan.weeklySchedule[sessionIndex];
    if (!session) return;
    byWeekday.set(weekdayIndex, {
      label: sessionLabel(session, sessionIndex, plan),
      exerciseCount: session.exercises.length
    });
  });

  const durationMinutes = plan.sessionDurationMinutes || 60;

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
