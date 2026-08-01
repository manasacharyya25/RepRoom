export type WorkoutPlanStatus = "has_own" | "rough_idea" | "needs_plan";

export type WorkoutActivityType =
  | "warmup"
  | "exercise"
  | "rest"
  | "cooldown";

export type WorkoutActivity = {
  type: WorkoutActivityType;
  name: string;
  sets: number | null;
  reps: string | null;
  restSeconds: number | null;
  durationSeconds: number | null;
  youtubeQuery: string | null;
};

export type WorkoutPlanDay = {
  day: number;
  title: string;
  activities: WorkoutActivity[];
};

export type WorkoutPlan = {
  name: string;
  description: string;
  goal: string;
  experience: string;
  workoutStyle: string;
  split: string;
  sessionsPerWeek: number;
  sessionDurationSeconds: number;
  days: WorkoutPlanDay[];
  /** static fallback, fresh AI generation, or served from template cache. */
  source: "static" | "ai" | "cache";
};

type PlanSeed = {
  primaryGoal: string;
  experience: string;
  daysPerWeek: number;
  sessionMinutes: number;
};

const GOAL_LABELS: Record<string, string> = {
  build_muscle: "Build Muscle",
  lose_fat: "Lose Fat",
  get_stronger: "Get Stronger",
  improve_endurance: "Improve Endurance",
  more_flexible: "Become More Flexible",
  stay_healthy: "Stay Healthy & Active",
  stay_consistent: "Stay Consistent"
};

const EXPERIENCE_LABELS: Record<string, string> = {
  just_starting: "Beginner",
  under_1_year: "Beginner",
  "1_3_years": "Intermediate",
  "3_plus_years": "Advanced"
};

const STYLE_BY_GOAL: Record<string, { style: string; split: string }> = {
  build_muscle: { style: "Strength Training", split: "Full Body" },
  lose_fat: { style: "Metabolic Conditioning", split: "Full Body" },
  get_stronger: { style: "Strength Training", split: "Full Body" },
  improve_endurance: { style: "Endurance Training", split: "Cardio + Strength" },
  more_flexible: { style: "Mobility", split: "Full Body Mobility" },
  stay_healthy: { style: "General Fitness", split: "Full Body" },
  stay_consistent: { style: "Habit Building", split: "Full Body" }
};

const DAY_TITLES = [
  "Full Body",
  "Upper Body",
  "Lower Body",
  "Push",
  "Pull",
  "Cardio + Strength"
];

type ExerciseSeed = {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  durationSeconds: number;
  youtubeQuery: string;
};

const DAY_EXERCISES: ExerciseSeed[][] = [
  [
    {
      name: "Barbell Squat",
      sets: 3,
      reps: "8-10",
      restSeconds: 120,
      durationSeconds: 600,
      youtubeQuery: "barbell squat proper form"
    },
    {
      name: "Bench Press",
      sets: 3,
      reps: "8-10",
      restSeconds: 90,
      durationSeconds: 540,
      youtubeQuery: "bench press proper form"
    },
    {
      name: "Lat Pulldown",
      sets: 3,
      reps: "10-12",
      restSeconds: 75,
      durationSeconds: 480,
      youtubeQuery: "lat pulldown proper form"
    },
    {
      name: "Romanian Deadlift",
      sets: 3,
      reps: "10",
      restSeconds: 90,
      durationSeconds: 540,
      youtubeQuery: "romanian deadlift proper form"
    },
    {
      name: "Dumbbell Shoulder Press",
      sets: 2,
      reps: "12",
      restSeconds: 60,
      durationSeconds: 360,
      youtubeQuery: "dumbbell shoulder press proper form"
    },
    {
      name: "Plank",
      sets: 3,
      reps: "30-45 sec",
      restSeconds: 45,
      durationSeconds: 240,
      youtubeQuery: "plank proper form"
    }
  ],
  [
    {
      name: "Leg Press",
      sets: 3,
      reps: "10-12",
      restSeconds: 90,
      durationSeconds: 540,
      youtubeQuery: "leg press proper form"
    },
    {
      name: "Incline Dumbbell Press",
      sets: 3,
      reps: "10",
      restSeconds: 75,
      durationSeconds: 480,
      youtubeQuery: "incline dumbbell press proper form"
    },
    {
      name: "Seated Cable Row",
      sets: 3,
      reps: "10-12",
      restSeconds: 75,
      durationSeconds: 480,
      youtubeQuery: "seated cable row proper form"
    },
    {
      name: "Walking Lunges",
      sets: 2,
      reps: "12 each leg",
      restSeconds: 60,
      durationSeconds: 360,
      youtubeQuery: "walking lunges proper form"
    },
    {
      name: "Dumbbell Lateral Raise",
      sets: 2,
      reps: "15",
      restSeconds: 45,
      durationSeconds: 300,
      youtubeQuery: "dumbbell lateral raise proper form"
    },
    {
      name: "Dead Bug",
      sets: 3,
      reps: "12 each side",
      restSeconds: 45,
      durationSeconds: 300,
      youtubeQuery: "dead bug exercise proper form"
    }
  ],
  [
    {
      name: "Goblet Squat",
      sets: 3,
      reps: "12",
      restSeconds: 75,
      durationSeconds: 480,
      youtubeQuery: "goblet squat proper form"
    },
    {
      name: "Machine Chest Press",
      sets: 3,
      reps: "10",
      restSeconds: 75,
      durationSeconds: 480,
      youtubeQuery: "machine chest press proper form"
    },
    {
      name: "Assisted Pull-Up",
      sets: 3,
      reps: "8-10",
      restSeconds: 75,
      durationSeconds: 480,
      youtubeQuery: "assisted pull up proper form"
    },
    {
      name: "Hip Thrust",
      sets: 3,
      reps: "10",
      restSeconds: 90,
      durationSeconds: 540,
      youtubeQuery: "hip thrust proper form"
    },
    {
      name: "Cable Face Pull",
      sets: 2,
      reps: "15",
      restSeconds: 45,
      durationSeconds: 300,
      youtubeQuery: "cable face pull proper form"
    },
    {
      name: "Hanging Knee Raise",
      sets: 3,
      reps: "12",
      restSeconds: 45,
      durationSeconds: 300,
      youtubeQuery: "hanging knee raise proper form"
    }
  ],
  [
    {
      name: "Front Squat",
      sets: 3,
      reps: "8-10",
      restSeconds: 90,
      durationSeconds: 540,
      youtubeQuery: "front squat proper form"
    },
    {
      name: "Push-Up",
      sets: 3,
      reps: "10-15",
      restSeconds: 60,
      durationSeconds: 360,
      youtubeQuery: "push up proper form"
    },
    {
      name: "One-Arm Dumbbell Row",
      sets: 3,
      reps: "10 each side",
      restSeconds: 60,
      durationSeconds: 420,
      youtubeQuery: "one arm dumbbell row proper form"
    },
    {
      name: "Dumbbell RDL",
      sets: 3,
      reps: "10",
      restSeconds: 75,
      durationSeconds: 480,
      youtubeQuery: "dumbbell romanian deadlift proper form"
    },
    {
      name: "Side Plank",
      sets: 2,
      reps: "30 sec each",
      restSeconds: 45,
      durationSeconds: 240,
      youtubeQuery: "side plank proper form"
    }
  ],
  [
    {
      name: "Trap Bar Deadlift",
      sets: 3,
      reps: "5-8",
      restSeconds: 120,
      durationSeconds: 600,
      youtubeQuery: "trap bar deadlift proper form"
    },
    {
      name: "Overhead Press",
      sets: 3,
      reps: "8-10",
      restSeconds: 90,
      durationSeconds: 540,
      youtubeQuery: "overhead press proper form"
    },
    {
      name: "Pull-Up",
      sets: 3,
      reps: "6-10",
      restSeconds: 90,
      durationSeconds: 540,
      youtubeQuery: "pull up proper form"
    },
    {
      name: "Bulgarian Split Squat",
      sets: 2,
      reps: "10 each leg",
      restSeconds: 75,
      durationSeconds: 420,
      youtubeQuery: "bulgarian split squat proper form"
    },
    {
      name: "Cable Woodchop",
      sets: 2,
      reps: "12 each side",
      restSeconds: 45,
      durationSeconds: 300,
      youtubeQuery: "cable woodchop proper form"
    }
  ],
  [
    {
      name: "Hack Squat",
      sets: 3,
      reps: "10-12",
      restSeconds: 90,
      durationSeconds: 540,
      youtubeQuery: "hack squat proper form"
    },
    {
      name: "Dumbbell Bench Press",
      sets: 3,
      reps: "10",
      restSeconds: 75,
      durationSeconds: 480,
      youtubeQuery: "dumbbell bench press proper form"
    },
    {
      name: "Chest-Supported Row",
      sets: 3,
      reps: "10-12",
      restSeconds: 75,
      durationSeconds: 480,
      youtubeQuery: "chest supported row proper form"
    },
    {
      name: "Hamstring Curl",
      sets: 3,
      reps: "12",
      restSeconds: 60,
      durationSeconds: 360,
      youtubeQuery: "hamstring curl proper form"
    },
    {
      name: "Farmer Carry",
      sets: 3,
      reps: "30-40 sec",
      restSeconds: 60,
      durationSeconds: 360,
      youtubeQuery: "farmer carry proper form"
    }
  ]
];

function activity(
  partial: WorkoutActivity
): WorkoutActivity {
  return partial;
}

function buildDayActivities(exercises: ExerciseSeed[]): WorkoutActivity[] {
  const core = exercises.slice(0, Math.max(1, exercises.length - 1));
  const addOns = exercises.slice(Math.max(1, exercises.length - 1));

  const activities: WorkoutActivity[] = [
    activity({
      type: "warmup",
      name: "Brisk Walk",
      sets: 1,
      reps: "5 min",
      restSeconds: null,
      durationSeconds: 300,
      youtubeQuery: "5 minute treadmill warm up"
    }),
    activity({
      type: "warmup",
      name: "Dynamic Hip Mobility",
      sets: 1,
      reps: "2 min",
      restSeconds: null,
      durationSeconds: 120,
      youtubeQuery: "dynamic hip mobility warm up"
    })
  ];

  core.forEach((exercise) => {
    activities.push(
      activity({
        type: "exercise",
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        restSeconds: 60,
        durationSeconds: Math.min(90, Math.max(30, Math.round(exercise.durationSeconds / exercise.sets))),
        youtubeQuery: exercise.youtubeQuery
      })
    );
  });

  addOns.forEach((exercise) => {
    activities.push(
      activity({
        type: "exercise",
        name: `ADD-ON : ${exercise.name}`,
        sets: Math.min(2, exercise.sets),
        reps: exercise.reps,
        restSeconds: 60,
        durationSeconds: Math.min(60, Math.max(30, Math.round(exercise.durationSeconds / exercise.sets))),
        youtubeQuery: exercise.youtubeQuery
      })
    );
  });

  activities.push(
    activity({
      type: "cooldown",
      name: "Hamstring Stretch",
      sets: 1,
      reps: "60 sec",
      restSeconds: null,
      durationSeconds: 60,
      youtubeQuery: "hamstring stretch"
    }),
    activity({
      type: "cooldown",
      name: "Chest Stretch",
      sets: 1,
      reps: "60 sec",
      restSeconds: null,
      durationSeconds: 60,
      youtubeQuery: "chest stretch"
    })
  );

  return activities;
}

export function workoutTabLabel(day: WorkoutPlanDay, index: number): string {
  return `Day ${day.day || index + 1}`;
}

/**
 * Display/total seconds for an activity.
 * Exercises: durationSeconds is per-set → multiply by sets.
 * Warmup / cooldown: durationSeconds is the full block.
 * Rest activities are no longer used (fixed 60s between exercises in UI).
 */
export function activityTotalSeconds(activity: WorkoutActivity): number {
  const base = Math.max(0, activity.durationSeconds ?? 0);
  if (activity.type === "exercise") {
    const sets = Math.max(1, activity.sets ?? 1);
    return base * sets;
  }
  if (activity.type === "rest") {
    return 60;
  }
  return base;
}

/** Rounded-up minutes for an activity (never show leftover seconds). */
export function activityDisplayMinutes(activity: WorkoutActivity): number {
  return Math.max(1, Math.ceil(activityTotalSeconds(activity) / 60));
}

export function dayTotalSeconds(day: WorkoutPlanDay): number {
  const usable = day.activities.filter((item) => item.type !== "rest");
  const workSeconds = usable.reduce(
    (sum, activity) => sum + activityTotalSeconds(activity),
    0
  );
  const exerciseCount = usable.filter(
    (item) => item.type === "exercise"
  ).length;
  const betweenRestSeconds = Math.max(0, exerciseCount - 1) * 60;
  return workSeconds + betweenRestSeconds;
}

/** Scale exercise/warmup/cooldown durations so the day totals ~ target session. */
export function scalePlanToSessionDuration(plan: WorkoutPlan): WorkoutPlan {
  const target = plan.sessionDurationSeconds || 3600;
  return {
    ...plan,
    days: plan.days.map((day) => {
      const cleaned: WorkoutPlanDay = {
        ...day,
        activities: day.activities
          .filter((activity) => activity.type !== "rest")
          .map((activity) =>
            activity.type === "exercise"
              ? { ...activity, restSeconds: 60 }
              : activity
          )
      };
      const current = dayTotalSeconds(cleaned);
      const scaledActivities =
        current <= 0
          ? cleaned.activities
          : cleaned.activities.map((activity) => {
              if (activity.durationSeconds == null) {
                return activity.type === "exercise"
                  ? { ...activity, restSeconds: 60 }
                  : activity;
              }
              const factor = target / current;
              return {
                ...activity,
                durationSeconds: Math.max(
                  15,
                  Math.round(activity.durationSeconds * factor)
                ),
                restSeconds:
                  activity.type === "exercise" ? 60 : activity.restSeconds
              };
            });

      return {
        ...cleaned,
        activities: insertRestBetweenExercises(scaledActivities)
      };
    })
  };
}

/** App-owned 60s rest blocks between exercises (not from the LLM). */
export function insertRestBetweenExercises(
  activities: WorkoutActivity[]
): WorkoutActivity[] {
  const warmups = activities.filter((item) => item.type === "warmup");
  const exercises = activities.filter((item) => item.type === "exercise");
  const cooldowns = activities.filter((item) => item.type === "cooldown");
  const other = activities.filter(
    (item) =>
      item.type !== "warmup" &&
      item.type !== "exercise" &&
      item.type !== "cooldown" &&
      item.type !== "rest"
  );

  const restBlock = (): WorkoutActivity => ({
    type: "rest",
    name: "Rest",
    sets: null,
    reps: null,
    restSeconds: null,
    durationSeconds: 60,
    youtubeQuery: null
  });

  const sequenced: WorkoutActivity[] = [...warmups];
  exercises.forEach((exercise, index) => {
    sequenced.push({ ...exercise, restSeconds: 60 });
    if (index < exercises.length - 1) {
      sequenced.push(restBlock());
    }
  });
  sequenced.push(...cooldowns, ...other);
  return sequenced;
}

export function sessionDurationMinutes(plan: WorkoutPlan): number {
  return Math.max(1, Math.round((plan.sessionDurationSeconds || 3600) / 60));
}

export function warmupActivities(day: WorkoutPlanDay): WorkoutActivity[] {
  return day.activities.filter((item) => item.type === "warmup");
}

/** Exercises with app-inserted rest blocks between them. */
export function workoutListActivities(day: WorkoutPlanDay): WorkoutActivity[] {
  return day.activities.filter(
    (item) => item.type === "exercise" || item.type === "rest"
  );
}

export function isAddOnActivity(activity: WorkoutActivity): boolean {
  return /^add-?on\s*:/i.test(activity.name.trim());
}

export function exerciseCount(day: WorkoutPlanDay): number {
  return day.activities.filter((item) => item.type === "exercise").length;
}

export function warmupDurationSeconds(day: WorkoutPlanDay): number {
  return warmupActivities(day).reduce(
    (sum, item) => sum + activityTotalSeconds(item),
    0
  );
}

/** Clock label rounded up to whole minutes (MM:00). */
export function formatSecondsClock(totalSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(Math.max(0, totalSeconds) / 60));
  return `${String(minutes).padStart(2, "0")}:00`;
}

export function activityYoutubeQuery(activity: WorkoutActivity): string | null {
  if (activity.type === "rest") return null;
  return activity.youtubeQuery?.trim() || activity.name;
}

/** Static LLM-shaped plan — replace with one-shot AI generation later. */
export function buildStaticWorkoutPlan(seed: PlanSeed): WorkoutPlan {
  const sessionsPerWeek = Math.min(6, Math.max(2, seed.daysPerWeek || 3));
  const sessionMinutes = seed.sessionMinutes || 60;
  const goal = GOAL_LABELS[seed.primaryGoal] ?? "Build Muscle";
  const experience = EXPERIENCE_LABELS[seed.experience] ?? "Beginner";
  const { style, split } = STYLE_BY_GOAL[seed.primaryGoal] ?? {
    style: "Strength Training",
    split: "Full Body"
  };

  const days: WorkoutPlanDay[] = Array.from(
    { length: sessionsPerWeek },
    (_, index) => ({
      day: index + 1,
      title: DAY_TITLES[index] ?? `Day ${index + 1}`,
      activities: buildDayActivities(
        DAY_EXERCISES[index] ?? DAY_EXERCISES[0] ?? []
      )
    })
  );

  return {
    name: `${experience} ${split}`,
    description: `A ${sessionsPerWeek}-day ${split.toLowerCase()} routine focused on ${goal.toLowerCase()} using compound movements and simple progression.`,
    goal,
    experience,
    workoutStyle: style,
    split,
    sessionsPerWeek,
    sessionDurationSeconds: sessionMinutes * 60,
    days,
    source: "static"
  };
}

export function withPlanSource(
  plan: WorkoutPlan,
  source: WorkoutPlan["source"]
): WorkoutPlan {
  return { ...plan, source };
}

/** Accept new plans, and map legacy onboarding plans if still stored. */
export function normalizeWorkoutPlan(raw: unknown): WorkoutPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const plan = raw as Record<string, unknown>;

  if (Array.isArray(plan.days)) {
    const typed = plan as unknown as WorkoutPlan;
    return {
      ...typed,
      days: typed.days.map((day) => ({
        ...day,
        activities: day.activities
          .filter((item) => item.type !== "rest")
          .map((item) =>
            item.type === "exercise" ? { ...item, restSeconds: 60 } : item
          )
      }))
    };
  }

  // Legacy shape → best-effort conversion
  const weekly = plan.weeklySchedule;
  if (!Array.isArray(weekly)) return null;

  const minutes =
    typeof plan.sessionDurationMinutes === "number"
      ? plan.sessionDurationMinutes
      : 60;

  const days: WorkoutPlanDay[] = weekly.map((session, index) => {
    const row = session as {
      day?: string;
      exercises?: Array<{
        exercise: string;
        sets: number;
        reps: string;
        restSeconds: number;
      }>;
    };
    const exercises = row.exercises ?? [];
    const activities: WorkoutActivity[] = [];

    const legacyWarmup = plan.warmup as
      | { steps?: string[]; durationMinutes?: number }
      | undefined;
    (legacyWarmup?.steps ?? []).forEach((step) => {
      activities.push(
        activity({
          type: "warmup",
          name: step,
          sets: 1,
          reps: null,
          restSeconds: null,
          durationSeconds: null,
          youtubeQuery: step
        })
      );
    });

    exercises.forEach((exercise) => {
      activities.push(
        activity({
          type: "exercise",
          name: exercise.exercise,
          sets: exercise.sets,
          reps: exercise.reps,
          restSeconds: 60,
          durationSeconds: null,
          youtubeQuery: `${exercise.exercise} proper form`
        })
      );
    });

    return {
      day: index + 1,
      title: row.day?.replace(/^Workout\s+/i, "") || DAY_TITLES[index] || `Day ${index + 1}`,
      activities
    };
  });

  return {
    name: String(plan.name ?? "Workout Plan"),
    description: String(plan.description ?? ""),
    goal: String(plan.goal ?? ""),
    experience: String(plan.experience ?? ""),
    workoutStyle: String(plan.workoutStyle ?? ""),
    split: String(plan.split ?? ""),
    sessionsPerWeek:
      typeof plan.sessionsPerWeek === "number"
        ? plan.sessionsPerWeek
        : days.length,
    sessionDurationSeconds: minutes * 60,
    days,
    source: "static"
  };
}
