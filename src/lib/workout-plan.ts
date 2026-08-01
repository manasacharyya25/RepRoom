export type WorkoutPlanStatus = "has_own" | "rough_idea" | "needs_plan";

export type WorkoutPlanExercise = {
  exercise: string;
  sets: number;
  reps: string;
  restSeconds: number;
};

export type WorkoutPlanSession = {
  day: string;
  exercises: WorkoutPlanExercise[];
};

export type WorkoutPlan = {
  name: string;
  description: string;
  goal: string;
  experience: string;
  workoutStyle: string;
  split: string;
  sessionsPerWeek: number;
  sessionDurationMinutes: number;
  warmup: {
    durationMinutes: number;
    steps: string[];
  };
  weeklySchedule: WorkoutPlanSession[];
  progression: {
    method: string;
    instructions: string[];
  };
  cooldown: {
    durationMinutes: number;
    steps: string[];
  };
  notes: string[];
  /** Local marker until AI generation is wired. */
  source: "static";
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

/** Static LLM-shaped plan — replace with one-shot AI generation later. */
export function buildStaticWorkoutPlan(seed: PlanSeed): WorkoutPlan {
  const sessionsPerWeek = Math.min(6, Math.max(2, seed.daysPerWeek || 3));
  const sessionDurationMinutes = seed.sessionMinutes || 60;
  const goal = GOAL_LABELS[seed.primaryGoal] ?? "Build Muscle";
  const experience = EXPERIENCE_LABELS[seed.experience] ?? "Beginner";
  const { style, split } = STYLE_BY_GOAL[seed.primaryGoal] ?? {
    style: "Strength Training",
    split: "Full Body"
  };

  const scheduleTemplates: WorkoutPlanSession[] = [
    {
      day: "Workout A",
      exercises: [
        {
          exercise: "Barbell Squat",
          sets: 3,
          reps: "8-10",
          restSeconds: 120
        },
        {
          exercise: "Barbell Bench Press",
          sets: 3,
          reps: "8-10",
          restSeconds: 90
        },
        {
          exercise: "Lat Pulldown",
          sets: 3,
          reps: "10-12",
          restSeconds: 75
        },
        {
          exercise: "Romanian Deadlift",
          sets: 3,
          reps: "10",
          restSeconds: 90
        },
        {
          exercise: "Dumbbell Shoulder Press",
          sets: 2,
          reps: "12",
          restSeconds: 60
        },
        {
          exercise: "Plank",
          sets: 3,
          reps: "30-45 sec",
          restSeconds: 45
        }
      ]
    },
    {
      day: "Workout B",
      exercises: [
        {
          exercise: "Leg Press",
          sets: 3,
          reps: "10-12",
          restSeconds: 90
        },
        {
          exercise: "Incline Dumbbell Press",
          sets: 3,
          reps: "10",
          restSeconds: 75
        },
        {
          exercise: "Seated Cable Row",
          sets: 3,
          reps: "10-12",
          restSeconds: 75
        },
        {
          exercise: "Walking Lunges",
          sets: 2,
          reps: "12 each leg",
          restSeconds: 60
        },
        {
          exercise: "Dumbbell Lateral Raise",
          sets: 2,
          reps: "15",
          restSeconds: 45
        },
        {
          exercise: "Dead Bug",
          sets: 3,
          reps: "12 each side",
          restSeconds: 45
        }
      ]
    },
    {
      day: "Workout C",
      exercises: [
        {
          exercise: "Goblet Squat",
          sets: 3,
          reps: "12",
          restSeconds: 75
        },
        {
          exercise: "Machine Chest Press",
          sets: 3,
          reps: "10",
          restSeconds: 75
        },
        {
          exercise: "Assisted Pull-Up or Lat Pulldown",
          sets: 3,
          reps: "8-10",
          restSeconds: 75
        },
        {
          exercise: "Hip Thrust",
          sets: 3,
          reps: "10",
          restSeconds: 90
        },
        {
          exercise: "Cable Face Pull",
          sets: 2,
          reps: "15",
          restSeconds: 45
        },
        {
          exercise: "Hanging Knee Raise",
          sets: 3,
          reps: "12",
          restSeconds: 45
        }
      ]
    },
    {
      day: "Workout D",
      exercises: [
        {
          exercise: "Front Squat or Goblet Squat",
          sets: 3,
          reps: "8-10",
          restSeconds: 90
        },
        {
          exercise: "Push-Up Variation",
          sets: 3,
          reps: "10-15",
          restSeconds: 60
        },
        {
          exercise: "One-Arm Dumbbell Row",
          sets: 3,
          reps: "10 each side",
          restSeconds: 60
        },
        {
          exercise: "Dumbbell RDL",
          sets: 3,
          reps: "10",
          restSeconds: 75
        },
        {
          exercise: "Side Plank",
          sets: 2,
          reps: "30 sec each",
          restSeconds: 45
        }
      ]
    },
    {
      day: "Workout E",
      exercises: [
        {
          exercise: "Trap Bar or Conventional Deadlift",
          sets: 3,
          reps: "5-8",
          restSeconds: 120
        },
        {
          exercise: "Overhead Press",
          sets: 3,
          reps: "8-10",
          restSeconds: 90
        },
        {
          exercise: "Pull-Up or Assisted Pull-Up",
          sets: 3,
          reps: "6-10",
          restSeconds: 90
        },
        {
          exercise: "Bulgarian Split Squat",
          sets: 2,
          reps: "10 each leg",
          restSeconds: 75
        },
        {
          exercise: "Cable Woodchop",
          sets: 2,
          reps: "12 each side",
          restSeconds: 45
        }
      ]
    },
    {
      day: "Workout F",
      exercises: [
        {
          exercise: "Hack Squat or Leg Press",
          sets: 3,
          reps: "10-12",
          restSeconds: 90
        },
        {
          exercise: "Dumbbell Bench Press",
          sets: 3,
          reps: "10",
          restSeconds: 75
        },
        {
          exercise: "Chest-Supported Row",
          sets: 3,
          reps: "10-12",
          restSeconds: 75
        },
        {
          exercise: "Hamstring Curl",
          sets: 3,
          reps: "12",
          restSeconds: 60
        },
        {
          exercise: "Farmer Carry",
          sets: 3,
          reps: "30-40 sec",
          restSeconds: 60
        }
      ]
    }
  ];

  return {
    name: `${experience} ${split} ${goal}`,
    description: `A ${sessionsPerWeek}-day ${split.toLowerCase()} routine focused on ${goal.toLowerCase()} using compound movements and simple progression.`,
    goal,
    experience,
    workoutStyle: style,
    split,
    sessionsPerWeek,
    sessionDurationMinutes,
    warmup: {
      durationMinutes: Math.min(10, Math.max(5, Math.round(sessionDurationMinutes * 0.12))),
      steps: [
        "5 minutes brisk walk or light cycling",
        "10 bodyweight squats",
        "10 arm circles each direction",
        "10 walking lunges",
        "10 band pull-aparts",
        "5 push-ups (knees if needed)"
      ]
    },
    weeklySchedule: scheduleTemplates.slice(0, sessionsPerWeek),
    progression: {
      method: "Double Progression",
      instructions: [
        "Stay within the prescribed rep range.",
        "Once all sets reach the upper rep target with good form, increase the weight by the smallest available increment.",
        "If you cannot complete the minimum reps, reduce the weight by 5-10% for the next session.",
        "Deload every 8 weeks by reducing volume by approximately 40%."
      ]
    },
    cooldown: {
      durationMinutes: 5,
      steps: [
        "Hamstring stretch - 30 sec",
        "Quadriceps stretch - 30 sec each leg",
        "Chest stretch - 30 sec",
        "Lat stretch - 30 sec each side",
        "Hip flexor stretch - 30 sec each side",
        "Deep breathing for 2 minutes"
      ]
    },
    notes: [
      "Leave 1-2 reps in reserve on most sets.",
      "Focus on controlled movement rather than lifting heavier weights.",
      "Sleep 7-9 hours for optimal recovery.",
      "Consume sufficient protein to support muscle growth."
    ],
    source: "static"
  };
}
