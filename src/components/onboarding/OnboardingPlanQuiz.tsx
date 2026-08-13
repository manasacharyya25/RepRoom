"use client";

import type { OnboardingPlanQuizAnswers } from "@/lib/onboarding-draft";

type ChoiceOption = { value: string; label: string; emoji?: string };

export const PLAN_FOCUS_OPTIONS = [
  { value: "full_body", emoji: "🧍", label: "Full body" },
  { value: "chest", emoji: "💥", label: "Chest" },
  { value: "back", emoji: "🔼", label: "Back" },
  { value: "legs", emoji: "🦶", label: "Legs" },
  { value: "shoulders", emoji: "💪", label: "Shoulders" },
  { value: "arms", emoji: "🦾", label: "Arms" },
  { value: "core", emoji: "🎯", label: "Core" }
] as const;

export const PLAN_STYLE_OPTIONS = [
  { value: "strength", emoji: "💪", label: "Strength" },
  { value: "hiit", emoji: "⚡", label: "HIIT" },
  { value: "yoga", emoji: "🧘", label: "Yoga" },
  { value: "pilates", emoji: "🤸", label: "Pilates" },
  { value: "walking", emoji: "🚶", label: "Walking" },
  { value: "jump_rope", emoji: "🪢", label: "Jump rope" }
] as const;

export const PLAN_EQUIPMENT_OPTIONS = [
  { value: "none", emoji: "🙌", label: "None" },
  { value: "bands", emoji: "🪢", label: "Bands" },
  { value: "dumbbells", emoji: "🏋️", label: "Dumbbells" },
  { value: "home_gym", emoji: "🏠", label: "Home gym" },
  { value: "full_gym", emoji: "🏟️", label: "Full gym" }
] as const;

const EATING_HABITS = [
  { value: "very_healthy", emoji: "🥗", label: "Very healthy" },
  { value: "mostly_healthy", emoji: "🙂", label: "Mostly healthy" },
  { value: "could_be_better", emoji: "😐", label: "Could be better" },
  { value: "mostly_unhealthy", emoji: "🍔", label: "Mostly unhealthy" }
] as const;

const MEALS_PER_DAY = [
  { value: "1_2", label: "1–2 meals" },
  { value: "3", label: "3 meals" },
  { value: "4", label: "4 meals" },
  { value: "5_plus", label: "5+ meals" }
] as const;

const SLEEP_HOURS = [
  { value: "under_5", emoji: "😴", label: "Less than 5 hours" },
  { value: "5_6", emoji: "💤", label: "5–6 hours" },
  { value: "6_8", emoji: "🌙", label: "6–8 hours" },
  { value: "8_plus", emoji: "🛌", label: "8+ hours" }
] as const;

const SLEEP_QUALITY = [
  { value: "excellent", emoji: "⭐", label: "Excellent" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "poor", emoji: "😵", label: "Poor" }
] as const;

const SKIP_REASONS = [
  { value: "lack_of_time", emoji: "⏰", label: "Lack of time" },
  { value: "low_energy", emoji: "😴", label: "Low energy" },
  { value: "lack_of_motivation", emoji: "😩", label: "Lack of motivation" },
  { value: "busy_schedule", emoji: "📅", label: "Busy/unpredictable schedule" },
  { value: "forget", emoji: "🥱", label: "I simply forget" }
] as const;

const MOTIVATIONS = [
  { value: "seeing_progress", emoji: "📈", label: "Seeing progress" },
  { value: "feeling_good", emoji: "🔥", label: "Feeling good after working out" },
  { value: "reaching_a_goal", emoji: "🎯", label: "Reaching a goal" },
  { value: "accountability", emoji: "👥", label: "Accountability" },
  { value: "competition", emoji: "🏆", label: "Competition" }
] as const;

const WORKOUT_WHEN = [
  { value: "morning", emoji: "🌅", label: "Morning" },
  { value: "afternoon", emoji: "☀️", label: "Afternoon" },
  { value: "evening", emoji: "🌆", label: "Evening" },
  { value: "late_night", emoji: "🌙", label: "Late night" },
  { value: "whenever", emoji: "🤷", label: "Whenever I can" }
] as const;

const WORKOUT_WHERE = [
  { value: "gym", emoji: "🏋️", label: "Gym" },
  { value: "home", emoji: "🏠", label: "Home" },
  { value: "outdoors", emoji: "🌳", label: "Outdoors" },
  { value: "mix", emoji: "🔄", label: "Mix of places" }
] as const;

const WORKOUT_ENJOY = [
  { value: "music", emoji: "🎵", label: "Good music" },
  { value: "with_others", emoji: "👥", label: "Working out with others" },
  { value: "challenge", emoji: "🔥", label: "Challenging myself" },
  { value: "mind_muscle", emoji: "🧘", label: "Mind-muscle connection" },
  { value: "fast_paced", emoji: "⚡", label: "Fast-paced workouts" },
  { value: "own_pace", emoji: "😌", label: "Taking it at my own pace" }
] as const;

export type { OnboardingPlanQuizAnswers };

export const EMPTY_PLAN_QUIZ: OnboardingPlanQuizAnswers = {
  focus: "",
  style: "",
  equipment: "",
  eatingHabits: "",
  mealsPerDay: "",
  sleepHours: "",
  sleepQuality: "",
  skipReason: "",
  motivation: "",
  workoutWhen: "",
  workoutWhere: "",
  workoutEnjoy: ""
};

export const PLAN_QUIZ_TOTAL = 7;
export const PLAN_QUIZ_GENERATE_AFTER = 2;

type QuizField = {
  title: string;
  key: keyof OnboardingPlanQuizAnswers;
  options: readonly ChoiceOption[];
  wrap?: boolean;
};

const PAGES: {
  title: string;
  kicker: string;
  fields: QuizField[];
}[] = [
  {
    title: "What's your focus?",
    kicker: "Plan details",
    fields: [{ title: "What's your focus?", key: "focus", options: PLAN_FOCUS_OPTIONS }]
  },
  {
    title: "What's your style?",
    kicker: "Plan details",
    fields: [{ title: "What's your style?", key: "style", options: PLAN_STYLE_OPTIONS }]
  },
  {
    title: "What equipment do you have?",
    kicker: "Plan details",
    fields: [
      {
        title: "What equipment do you have?",
        key: "equipment",
        options: PLAN_EQUIPMENT_OPTIONS
      }
    ]
  },
  {
    title: "About nutrition & eating habits",
    kicker: "Nutrition",
    fields: [
      {
        title: "How would you describe your eating habits?",
        key: "eatingHabits",
        options: EATING_HABITS
      },
      {
        title: "How many meals do you usually eat a day?",
        key: "mealsPerDay",
        options: MEALS_PER_DAY,
        wrap: true
      }
    ]
  },
  {
    title: "About sleep",
    kicker: "Sleep",
    fields: [
      {
        title: "How much do you usually sleep?",
        key: "sleepHours",
        options: SLEEP_HOURS
      },
      {
        title: "How would you rate your sleep quality?",
        key: "sleepQuality",
        options: SLEEP_QUALITY
      }
    ]
  },
  {
    title: "Behaviour",
    kicker: "Behaviour",
    fields: [
      {
        title: "What usually makes you skip a workout?",
        key: "skipReason",
        options: SKIP_REASONS,
        wrap: true
      },
      {
        title: "What motivates you the most?",
        key: "motivation",
        options: MOTIVATIONS,
        wrap: true
      }
    ]
  },
  {
    title: "Workout preferences",
    kicker: "Preferences",
    fields: [
      {
        title: "When do you prefer to work out?",
        key: "workoutWhen",
        options: WORKOUT_WHEN,
        wrap: true
      },
      {
        title: "Where do you prefer to work out?",
        key: "workoutWhere",
        options: WORKOUT_WHERE
      },
      {
        title: "What makes a workout enjoyable for you?",
        key: "workoutEnjoy",
        options: WORKOUT_ENJOY,
        wrap: true
      }
    ]
  }
];

function ChoiceGrid({
  options,
  value,
  onChange,
  wrap = false
}: {
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  wrap?: boolean;
}) {
  const hasEmoji = options.some((option) => option.emoji);
  return (
    <div
      className={`onboarding-option-grid${
        wrap || !hasEmoji
          ? " onboarding-option-grid--wrap"
          : " onboarding-option-grid--goals"
      }`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`onboarding-option-card${
            option.emoji ? " onboarding-option-card--goal" : ""
          }${value === option.value ? " is-selected" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.emoji ? (
            <span className="onboarding-option-emoji" aria-hidden>
              {option.emoji}
            </span>
          ) : null}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function planQuizAnswer(
  answers: OnboardingPlanQuizAnswers,
  qIndex: number
) {
  const page = PAGES[qIndex];
  if (!page) return "";
  return page.fields.every((field) => answers[field.key]) ? "ok" : "";
}

export function OnboardingPlanQuiz({
  qIndex,
  answers,
  onChange,
  planReady
}: {
  qIndex: number;
  answers: OnboardingPlanQuizAnswers;
  onChange: (patch: Partial<OnboardingPlanQuizAnswers>) => void;
  planReady: boolean;
}) {
  const page = PAGES[qIndex];
  if (!page) return null;

  const almostThere = qIndex > PLAN_QUIZ_GENERATE_AFTER;
  const stacked = page.fields.length > 1;

  return (
    <>
      <header className="onboarding-card-head">
        <p className="onboarding-kicker">
          Step 4 of 4 · {page.kicker}
        </p>
        <h1 id="onboarding-title">{page.title}</h1>
        <p className="onboarding-lede">
          {almostThere
            ? "We're building your plan while you finish a few more questions."
            : "We'll use this to personalize your routine."}
        </p>
      </header>

      {almostThere ? (
        <div
          className={`plan-almost${planReady ? " is-ready" : ""}`}
          role="status"
        >
          <span className="plan-almost-pulse" aria-hidden />
          <div>
            <strong>{planReady ? "Your plan is ready" : "Almost there"}</strong>
            <p>
              {planReady
                ? "Finish these last questions and we'll show it."
                : "We're building your plan in the background."}
            </p>
          </div>
        </div>
      ) : null}

      <p className="plan-question-step">
        {String(qIndex + 1).padStart(2, "0")} /{" "}
        {String(PLAN_QUIZ_TOTAL).padStart(2, "0")}
      </p>

      <div className={stacked ? "plan-quiz-stack" : undefined}>
        {page.fields.map((field) => (
          <fieldset key={field.key} className="onboarding-fieldset">
            {stacked ? <legend>{field.title}</legend> : null}
            <ChoiceGrid
              options={field.options}
              value={answers[field.key]}
              onChange={(value) => onChange({ [field.key]: value })}
              wrap={field.wrap}
            />
          </fieldset>
        ))}
      </div>
    </>
  );
}
