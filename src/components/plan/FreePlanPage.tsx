"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import "@/app/landing.css";
import "@/app/onboarding.css";
import "@/app/plan.css";
import { Logo } from "@/components/brand/Logo";
import { PlanGeneratingScreen, REVEAL_HOLD_MS } from "@/components/plan/PlanGeneratingScreen";
import { PlanReviewView } from "@/components/plan/PlanReviewView";
import {
  clearFreePlanDraft,
  readFreePlanDraft,
  saveFreePlanDraft,
  type FreePlanDraft,
  type FreePlanLifestyle
} from "@/lib/free-plan-draft";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeWorkoutPlan,
  scalePlanToSessionDuration,
  type WorkoutPlan
} from "@/lib/workout-plan";

const FITNESS_EXPERIENCE = [
  { value: "just_starting", label: "Just starting" },
  { value: "under_1_year", label: "<1 year" },
  { value: "1_3_years", label: "1–3 years" },
  { value: "3_plus_years", label: "3+ years" }
] as const;

const PRIMARY_GOALS = [
  { value: "build_muscle", emoji: "💪", label: "Build muscle" },
  { value: "lose_fat", emoji: "🔥", label: "Lose fat" },
  { value: "get_stronger", emoji: "⚡", label: "Get stronger" },
  { value: "improve_endurance", emoji: "❤️", label: "Endurance" },
  { value: "more_flexible", emoji: "🧘", label: "Flexibility" },
  { value: "stay_healthy", emoji: "🌱", label: "Stay healthy" },
  { value: "stay_consistent", emoji: "📅", label: "Stay consistent" }
] as const;

const PLAN_FOCUS_OPTIONS = [
  { value: "full_body", emoji: "🧍", label: "Full body" },
  { value: "chest", emoji: "💥", label: "Chest" },
  { value: "back", emoji: "🔼", label: "Back" },
  { value: "legs", emoji: "🦶", label: "Legs" },
  { value: "shoulders", emoji: "💪", label: "Shoulders" },
  { value: "arms", emoji: "🦾", label: "Arms" },
  { value: "core", emoji: "🎯", label: "Core" }
] as const;

const PLAN_EQUIPMENT_OPTIONS = [
  { value: "none", emoji: "🙌", label: "None" },
  { value: "bands", emoji: "🪢", label: "Bands" },
  { value: "dumbbells", emoji: "🏋️", label: "Dumbbells" },
  { value: "home_gym", emoji: "🏠", label: "Home gym" },
  { value: "full_gym", emoji: "🏟️", label: "Full gym" }
] as const;

const PLAN_STYLE_OPTIONS = [
  { value: "strength", emoji: "💪", label: "Strength" },
  { value: "hiit", emoji: "⚡", label: "HIIT" },
  { value: "yoga", emoji: "🧘", label: "Yoga" },
  { value: "pilates", emoji: "🤸", label: "Pilates" },
  { value: "walking", emoji: "🚶", label: "Walking" },
  { value: "jump_rope", emoji: "🪢", label: "Jump rope" }
] as const;

const WORKOUT_FREQUENCY = [
  { value: 2, label: "2 days/week" },
  { value: 3, label: "3 days/week" },
  { value: 4, label: "4 days/week" },
  { value: 5, label: "5 days/week" },
  { value: 6, label: "6+ days/week" }
] as const;

const SESSION_LENGTHS = [
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90+ min" }
] as const;

const AGE_RANGES = [
  { value: "18-24", label: "18–24" },
  { value: "25-34", label: "25–34" },
  { value: "35-44", label: "35–44" },
  { value: "45+", label: "45+" }
] as const;

const GENDERS = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not", label: "Prefer not to say" }
] as const;

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "beginner", label: "Beginner" },
  { value: "somewhat_active", label: "Somewhat active" },
  { value: "regular_gym", label: "Regular gym-goer" },
  { value: "athlete", label: "Athlete" }
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

const CORE_TOTAL = 7;
const EXTRA_TOTAL = 5;
const TOTAL_Q = CORE_TOTAL + EXTRA_TOTAL;

type Step = "hub" | "build" | "generating" | "review";

type ChoiceOption = { value: string; label: string; emoji?: string };

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

function extraSectionIndex(qIndex: number) {
  return Math.max(0, qIndex - CORE_TOTAL);
}

export function FreePlanPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<Step>("hub");
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);

  const [primaryGoal, setPrimaryGoal] = useState("");
  const [fitnessExperience, setFitnessExperience] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [sessionMinutes, setSessionMinutes] = useState<number | null>(null);
  const [focus, setFocus] = useState("");
  const [equipment, setEquipment] = useState("");
  const [style, setStyle] = useState("");
  const [qIndex, setQIndex] = useState(0);

  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [heightFeet, setHeightFeet] = useState("5");
  const [heightInches, setHeightInches] = useState("11");
  const [heightCm, setHeightCm] = useState("180");
  const [heightUnit, setHeightUnit] = useState<"imperial" | "metric">("imperial");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [currentWeight, setCurrentWeight] = useState("95");
  const [eatingHabits, setEatingHabits] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [motivation, setMotivation] = useState("");
  const [workoutWhen, setWorkoutWhen] = useState("");
  const [workoutWhere, setWorkoutWhere] = useState("");
  const [workoutEnjoy, setWorkoutEnjoy] = useState("");

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [revealAt, setRevealAt] = useState<number | null>(null);

  const generateSeqRef = useRef(0);
  const stepRef = useRef(step);
  stepRef.current = step;

  const lifestyle: FreePlanLifestyle = {
    ageRange,
    gender,
    activityLevel,
    heightUnit,
    heightFeet,
    heightInches,
    heightCm,
    weightUnit,
    currentWeight,
    eatingHabits,
    mealsPerDay,
    sleepHours,
    sleepQuality,
    skipReason,
    motivation,
    workoutWhen,
    workoutWhere,
    workoutEnjoy
  };

  const snapshotRef = useRef({
    primaryGoal,
    fitnessExperience,
    daysPerWeek: daysPerWeek ?? 3,
    sessionMinutes: sessionMinutes ?? 60,
    focus,
    equipment,
    style,
    lifestyle
  });
  snapshotRef.current = {
    primaryGoal,
    fitnessExperience,
    daysPerWeek: daysPerWeek ?? 3,
    sessionMinutes: sessionMinutes ?? 60,
    focus,
    equipment,
    style,
    lifestyle
  };

  const applyLifestyle = (next: FreePlanLifestyle | undefined) => {
    if (!next) return;
    if (next.ageRange) setAgeRange(next.ageRange);
    if (next.gender) setGender(next.gender);
    if (next.activityLevel) setActivityLevel(next.activityLevel);
    if (next.heightUnit) setHeightUnit(next.heightUnit);
    if (next.heightFeet) setHeightFeet(next.heightFeet);
    if (next.heightInches) setHeightInches(next.heightInches);
    if (next.heightCm) setHeightCm(next.heightCm);
    if (next.weightUnit) setWeightUnit(next.weightUnit);
    if (next.currentWeight) setCurrentWeight(next.currentWeight);
    if (next.eatingHabits) setEatingHabits(next.eatingHabits);
    if (next.mealsPerDay) setMealsPerDay(next.mealsPerDay);
    if (next.sleepHours) setSleepHours(next.sleepHours);
    if (next.sleepQuality) setSleepQuality(next.sleepQuality);
    if (next.skipReason) setSkipReason(next.skipReason);
    if (next.motivation) setMotivation(next.motivation);
    if (next.workoutWhen) setWorkoutWhen(next.workoutWhen);
    if (next.workoutWhere) setWorkoutWhere(next.workoutWhere);
    if (next.workoutEnjoy) setWorkoutEnjoy(next.workoutEnjoy);
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const draft = readFreePlanDraft();
      if (draft?.plan) {
        const normalized =
          scalePlanToSessionDuration(
            normalizeWorkoutPlan(draft.plan) ?? draft.plan
          );
        if (!cancelled) {
          setPrimaryGoal(draft.primaryGoal);
          setFitnessExperience(draft.fitnessExperience);
          setDaysPerWeek(draft.daysPerWeek);
          setSessionMinutes(draft.sessionMinutes);
          setFocus(draft.focus || "");
          setEquipment(draft.equipment || "");
          setStyle(draft.style || "");
          applyLifestyle(draft.lifestyle);
          setPlan(normalized);
          setStep("review");
        }
      }

      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!cancelled) setUserId(user?.id ?? null);
      } catch {
        if (!cancelled) setUserId(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const persistDraft = (nextPlan: WorkoutPlan) => {
    const snap = snapshotRef.current;
    const draft: FreePlanDraft = {
      primaryGoal: snap.primaryGoal,
      fitnessExperience: snap.fitnessExperience,
      daysPerWeek: snap.daysPerWeek,
      sessionMinutes: snap.sessionMinutes,
      focus: snap.focus,
      equipment: snap.equipment,
      style: snap.style,
      plan: nextPlan,
      lifestyle: snap.lifestyle,
      savedAt: new Date().toISOString()
    };
    saveFreePlanDraft(draft);
  };

  useEffect(() => {
    if (!plan) return;
    persistDraft(plan);
  }, [
    plan,
    ageRange,
    gender,
    activityLevel,
    heightUnit,
    heightFeet,
    heightInches,
    heightCm,
    weightUnit,
    currentWeight,
    eatingHabits,
    mealsPerDay,
    sleepHours,
    sleepQuality,
    skipReason,
    motivation,
    workoutWhen,
    workoutWhere,
    workoutEnjoy
  ]);

  const startGenerateInBackground = () => {
    const seq = ++generateSeqRef.current;
    setGenerating(true);
    setError(null);
    setSaveSuccess(false);
    const body = {
      primaryGoal,
      fitnessExperience,
      daysPerWeek,
      sessionMinutes,
      focus,
      equipment,
      style
    };
    void (async () => {
      try {
        const response = await fetch("/api/workout-plan/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const payload = (await response.json().catch(() => null)) as {
          plan?: WorkoutPlan;
          error?: string;
        } | null;
        if (seq !== generateSeqRef.current) return;
        if (!response.ok || !payload?.plan) {
          throw new Error(
            payload?.error || "Could not generate your workout plan."
          );
        }
        const nextPlan = scalePlanToSessionDuration(
          normalizeWorkoutPlan(payload.plan) ?? payload.plan
        );
        setPlan(nextPlan);
        persistDraft(nextPlan);
      } catch (caught) {
        if (seq !== generateSeqRef.current) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not generate your workout plan."
        );
        if (stepRef.current === "generating") {
          setRevealAt(null);
          setQIndex(TOTAL_Q - 1);
          setStep("build");
        }
      } finally {
        if (seq === generateSeqRef.current) setGenerating(false);
      }
    })();
  };

  useEffect(() => {
    if (step !== "generating" || revealAt == null || !plan) return;
    const wait = Math.max(0, REVEAL_HOLD_MS - (Date.now() - revealAt));
    const timer = window.setTimeout(() => {
      setRevealAt(null);
      setStep("review");
    }, wait);
    return () => window.clearTimeout(timer);
  }, [step, plan, revealAt]);

  const savePlanToProfile = async () => {
    if (!plan || saving) return false;
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setSignUpOpen(true);
        setSaving(false);
        return false;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          workout_plan: plan,
          workout_plan_status: "needs_plan",
          primary_fitness_goal: primaryGoal,
          fitness_experience: fitnessExperience,
          workout_days_per_week: daysPerWeek,
          session_minutes: sessionMinutes,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      clearFreePlanDraft();
      setSaveSuccess(true);
      setUserId(user.id);
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save your workout plan."
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onSaveClick = () => {
    if (!authReady) return;
    if (!userId) {
      setSignUpOpen(true);
      return;
    }
    if (plan) persistDraft(plan);
    void (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_completed_at")
          .eq("id", userId)
          .maybeSingle();
        if (!data?.onboarding_completed_at) {
          router.push("/onboarding");
          return;
        }
      } catch {
        router.push("/onboarding");
        return;
      }
      void savePlanToProfile();
    })();
  };

  const extraComplete =
    qIndex === 8
      ? Boolean(eatingHabits && mealsPerDay)
      : qIndex === 9
        ? Boolean(sleepHours && sleepQuality)
        : qIndex === 10
          ? Boolean(skipReason && motivation)
          : Boolean(workoutWhen && workoutWhere && workoutEnjoy);

  const canContinue =
    qIndex === 0
      ? Boolean(primaryGoal)
      : qIndex === 1
        ? Boolean(focus)
        : qIndex === 2
          ? Boolean(style)
          : qIndex === 3
            ? Boolean(equipment)
            : qIndex === 4
              ? Boolean(fitnessExperience)
              : qIndex === 5
                ? Boolean(daysPerWeek)
                : qIndex === 6
                  ? Boolean(sessionMinutes)
                  : qIndex === 7
                    ? Boolean(ageRange && gender && activityLevel)
                    : extraComplete;

  const questionTitle =
    qIndex === 0
      ? "What's your main goal?"
      : qIndex === 1
        ? "What's your focus?"
        : qIndex === 2
          ? "What's your style?"
          : qIndex === 3
            ? "What equipment do you have?"
            : qIndex === 4
              ? "What's your experience?"
              : qIndex === 5
                ? "How often do you want to work out?"
                : qIndex === 6
                  ? "How long can you train per session?"
                  : qIndex === 7
                    ? "A bit about you"
                    : qIndex === 8
                      ? "About nutrition & eating habits"
                      : qIndex === 9
                        ? "About sleep"
                        : qIndex === 10
                          ? "Behaviour"
                          : "Workout preferences";

  const beginReveal = () => {
    if (!plan && !generating) {
      startGenerateInBackground();
    }
    setError(null);
    setRevealAt(Date.now());
    setStep("generating");
  };

  const onContinue = () => {
    if (!canContinue) return;
    if (qIndex < CORE_TOTAL - 1) {
      setQIndex((index) => index + 1);
      return;
    }
    if (qIndex === CORE_TOTAL - 1) {
      setPlan(null);
      startGenerateInBackground();
      setQIndex(CORE_TOTAL);
      return;
    }
    if (qIndex < TOTAL_Q - 1) {
      setQIndex((index) => index + 1);
      return;
    }
    beginReveal();
  };

  const onBuildBack = () => {
    setError(null);
    if (qIndex > 0) {
      setQIndex((index) => index - 1);
      return;
    }
    setStep("hub");
  };

  const toLbs = (kg: number) => kg * 2.20462;
  const lbsToKg = (lbs: number) => lbs / 2.20462;

  const convertWeightDisplay = (value: string, from: "kg" | "lbs") => {
    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) return "—";
    if (from === "kg") return `${Math.round(toLbs(amount))} lbs`;
    return `${Math.round(lbsToKg(amount))} kg`;
  };

  const switchWeightUnit = (next: "kg" | "lbs") => {
    if (next === weightUnit) return;
    const amount = Number.parseFloat(currentWeight);
    if (Number.isFinite(amount)) {
      const converted = next === "kg" ? lbsToKg(amount) : toLbs(amount);
      setCurrentWeight(String(Math.round(converted * 10) / 10));
    }
    setWeightUnit(next);
  };

  const switchHeightUnit = (next: "imperial" | "metric") => {
    if (next === heightUnit) return;
    if (next === "metric") {
      const feet = Number.parseFloat(heightFeet) || 0;
      const inches = Number.parseFloat(heightInches) || 0;
      setHeightCm(String(Math.round((feet * 12 + inches) * 2.54)));
    } else {
      const cm = Number.parseFloat(heightCm) || 0;
      const totalInches = cm / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches - feet * 12);
      setHeightFeet(String(feet));
      setHeightInches(String(inches));
    }
    setHeightUnit(next);
  };

  const almostThere = qIndex >= CORE_TOTAL;
  const extraSection = extraSectionIndex(qIndex);
  const extraStepLabel = String(qIndex - CORE_TOTAL + 1).padStart(2, "0");

  return (
    <div
      className={`plan-page${
        step === "review"
          ? " plan-page--review"
          : step === "generating"
            ? " plan-page--generating"
            : ""
      }`}
    >
      <header className="landing-nav plan-nav">
        <Logo />
      </header>

      <main className="plan-main">
        {step === "hub" ? (
          <section className="plan-hub" aria-labelledby="plan-hub-title">
            <p className="plan-kicker">Free tool</p>
            <h1 id="plan-hub-title">Your workout plan, built for you</h1>
            <p className="plan-lede">
              Generate a RhoQ routine from your goals and schedule — no account
              needed. Sign up only when you want to save it.
            </p>

            <div className="plan-hub-cards">
              <button
                type="button"
                className="plan-hub-card"
                onClick={() => {
                  setError(null);
                  setQIndex(0);
                  setStep("build");
                }}
              >
                <span className="plan-hub-card-emoji" aria-hidden>
                  🏋️
                </span>
                <strong>Build my workout plan</strong>
                <span>
                  Answer a few questions — goal, focus, equipment, and style —
                  and we'll build a weekly routine.
                </span>
              </button>

              <button
                type="button"
                className="plan-hub-card"
                onClick={() => setComingSoonOpen(true)}
              >
                <span className="plan-hub-card-emoji" aria-hidden>
                  📋
                </span>
                <strong>Review my workout plan</strong>
                <span>
                  Bring your own routine and get a RhoQ-ready review. Coming
                  soon.
                </span>
              </button>
            </div>
          </section>
        ) : null}

        {step === "generating" ? (
          <PlanGeneratingScreen ready={Boolean(plan)} />
        ) : null}

        {step === "build" ? (
          <section className="plan-build" aria-labelledby="plan-build-title">
            <button
              type="button"
              className="plan-back"
              onClick={onBuildBack}
            >
              ← Back
            </button>
            <p className="plan-kicker">
              {almostThere
                ? (
                    [
                      "Personal info",
                      "Nutrition",
                      "Sleep",
                      "Behaviour",
                      "Preferences"
                    ][extraSection] ?? "Almost there"
                  )
                : "Build"}
            </p>
            <h1 id="plan-build-title" className="plan-build-title">
              {almostThere ? "A little more about you" : "Tell us how you train"}
            </h1>
            <p className="plan-lede plan-build-lede">
              {almostThere
                ? "We're building your plan in the background."
                : "We'll use this to find the best plan for you."}
            </p>

            {almostThere ? (
              <div
                className={`plan-almost${plan ? " is-ready" : ""}`}
                role="status"
              >
                <span className="plan-almost-pulse" aria-hidden />
                <div>
                  <strong>{plan ? "Your plan is ready" : "Almost there"}</strong>
                  <p>
                    {plan
                      ? "Finish these last questions and we'll show it."
                      : "We're building your plan while you answer a few more questions."}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="plan-form plan-question-card">
              <p className="plan-question-step">
                {almostThere
                  ? `${extraStepLabel} / ${String(EXTRA_TOTAL).padStart(2, "0")}`
                  : `${String(qIndex + 1).padStart(2, "0")} / ${String(CORE_TOTAL).padStart(2, "0")}`}
              </p>
              <h2 className="plan-question-title">{questionTitle}</h2>

              {qIndex === 0 ? (
                <ChoiceGrid
                  options={PRIMARY_GOALS}
                  value={primaryGoal}
                  onChange={setPrimaryGoal}
                />
              ) : null}

              {qIndex === 1 ? (
                <ChoiceGrid
                  options={PLAN_FOCUS_OPTIONS}
                  value={focus}
                  onChange={setFocus}
                />
              ) : null}

              {qIndex === 2 ? (
                <ChoiceGrid
                  options={PLAN_STYLE_OPTIONS}
                  value={style}
                  onChange={setStyle}
                />
              ) : null}

              {qIndex === 3 ? (
                <ChoiceGrid
                  options={PLAN_EQUIPMENT_OPTIONS}
                  value={equipment}
                  onChange={setEquipment}
                />
              ) : null}

              {qIndex === 4 ? (
                <ChoiceGrid
                  options={FITNESS_EXPERIENCE}
                  value={fitnessExperience}
                  onChange={setFitnessExperience}
                  wrap
                />
              ) : null}

              {qIndex === 5 ? (
                <div className="onboarding-option-grid onboarding-option-grid--wrap">
                  {WORKOUT_FREQUENCY.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`onboarding-option-card${
                        daysPerWeek === option.value ? " is-selected" : ""
                      }`}
                      onClick={() => setDaysPerWeek(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {qIndex === 6 ? (
                <div className="onboarding-option-grid onboarding-option-grid--wrap">
                  {SESSION_LENGTHS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`onboarding-option-card${
                        sessionMinutes === option.value ? " is-selected" : ""
                      }`}
                      onClick={() => setSessionMinutes(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {qIndex === 7 ? (
                <div className="plan-personal">
                  <fieldset className="onboarding-fieldset">
                    <legend>Age</legend>
                    <div className="onboarding-option-grid">
                      {AGE_RANGES.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`onboarding-option-card${
                            ageRange === option.value ? " is-selected" : ""
                          }`}
                          onClick={() => setAgeRange(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="onboarding-fieldset">
                    <legend>Gender</legend>
                    <div className="onboarding-option-grid">
                      {GENDERS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`onboarding-option-card${
                            gender === option.value ? " is-selected" : ""
                          }`}
                          onClick={() => setGender(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className="onboarding-biometrics onboarding-biometrics--you">
                    <div className="onboarding-biometrics-group">
                      <div className="onboarding-biometrics-label-row">
                        <span className="onboarding-biometrics-label">Height</span>
                        <div
                          className="onboarding-unit-toggle"
                          role="group"
                          aria-label="Height unit"
                        >
                          <button
                            type="button"
                            className={
                              heightUnit === "imperial" ? "is-selected" : undefined
                            }
                            onClick={() => switchHeightUnit("imperial")}
                          >
                            ft / in
                          </button>
                          <button
                            type="button"
                            className={
                              heightUnit === "metric" ? "is-selected" : undefined
                            }
                            onClick={() => switchHeightUnit("metric")}
                          >
                            cm
                          </button>
                        </div>
                      </div>

                      {heightUnit === "imperial" ? (
                        <div className="onboarding-measure-control">
                          <label className="onboarding-measure-slot">
                            <input
                              inputMode="numeric"
                              onChange={(event) =>
                                setHeightFeet(event.target.value)
                              }
                              type="text"
                              value={heightFeet}
                            />
                            <span>ft</span>
                          </label>
                          <label className="onboarding-measure-slot">
                            <input
                              inputMode="numeric"
                              onChange={(event) =>
                                setHeightInches(event.target.value)
                              }
                              type="text"
                              value={heightInches}
                            />
                            <span>in</span>
                          </label>
                        </div>
                      ) : (
                        <div className="onboarding-measure-control">
                          <label className="onboarding-measure-slot onboarding-measure-slot--grow">
                            <input
                              inputMode="decimal"
                              onChange={(event) =>
                                setHeightCm(event.target.value)
                              }
                              type="text"
                              value={heightCm}
                            />
                            <span>cm</span>
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="onboarding-biometrics-group">
                      <div className="onboarding-biometrics-label-row">
                        <span className="onboarding-biometrics-label">Weight</span>
                        <div
                          className="onboarding-unit-toggle"
                          role="group"
                          aria-label="Weight unit"
                        >
                          <button
                            type="button"
                            className={weightUnit === "kg" ? "is-selected" : undefined}
                            onClick={() => switchWeightUnit("kg")}
                          >
                            kg
                          </button>
                          <button
                            type="button"
                            className={
                              weightUnit === "lbs" ? "is-selected" : undefined
                            }
                            onClick={() => switchWeightUnit("lbs")}
                          >
                            lbs
                          </button>
                        </div>
                      </div>

                      <label className="onboarding-weight-field">
                        <div className="onboarding-measure-control">
                          <div className="onboarding-measure-slot onboarding-measure-slot--grow">
                            <input
                              inputMode="decimal"
                              onChange={(event) =>
                                setCurrentWeight(event.target.value)
                              }
                              type="text"
                              value={currentWeight}
                            />
                            <span>{weightUnit}</span>
                          </div>
                        </div>
                        <em className="onboarding-weight-hint">
                          ≈ {convertWeightDisplay(currentWeight, weightUnit)}
                        </em>
                      </label>
                    </div>
                  </div>

                  <fieldset className="onboarding-fieldset">
                    <legend>Lifestyle</legend>
                    <div className="onboarding-option-grid onboarding-option-grid--wrap">
                      {ACTIVITY_LEVELS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`onboarding-option-card${
                            activityLevel === option.value ? " is-selected" : ""
                          }`}
                          onClick={() => setActivityLevel(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              ) : null}

              {qIndex === 8 ? (
                <div className="plan-quiz-stack">
                  <fieldset className="onboarding-fieldset">
                    <legend>How would you describe your eating habits?</legend>
                    <ChoiceGrid
                      options={EATING_HABITS}
                      value={eatingHabits}
                      onChange={setEatingHabits}
                    />
                  </fieldset>
                  <fieldset className="onboarding-fieldset">
                    <legend>How many meals do you usually eat a day?</legend>
                    <ChoiceGrid
                      options={MEALS_PER_DAY}
                      value={mealsPerDay}
                      onChange={setMealsPerDay}
                      wrap
                    />
                  </fieldset>
                </div>
              ) : null}
              {qIndex === 9 ? (
                <div className="plan-quiz-stack">
                  <fieldset className="onboarding-fieldset">
                    <legend>How much do you usually sleep?</legend>
                    <ChoiceGrid
                      options={SLEEP_HOURS}
                      value={sleepHours}
                      onChange={setSleepHours}
                    />
                  </fieldset>
                  <fieldset className="onboarding-fieldset">
                    <legend>How would you rate your sleep quality?</legend>
                    <ChoiceGrid
                      options={SLEEP_QUALITY}
                      value={sleepQuality}
                      onChange={setSleepQuality}
                    />
                  </fieldset>
                </div>
              ) : null}
              {qIndex === 10 ? (
                <div className="plan-quiz-stack">
                  <fieldset className="onboarding-fieldset">
                    <legend>What usually makes you skip a workout?</legend>
                    <ChoiceGrid
                      options={SKIP_REASONS}
                      value={skipReason}
                      onChange={setSkipReason}
                      wrap
                    />
                  </fieldset>
                  <fieldset className="onboarding-fieldset">
                    <legend>What motivates you the most?</legend>
                    <ChoiceGrid
                      options={MOTIVATIONS}
                      value={motivation}
                      onChange={setMotivation}
                      wrap
                    />
                  </fieldset>
                </div>
              ) : null}
              {qIndex === 11 ? (
                <div className="plan-quiz-stack">
                  <fieldset className="onboarding-fieldset">
                    <legend>When do you prefer to work out?</legend>
                    <ChoiceGrid
                      options={WORKOUT_WHEN}
                      value={workoutWhen}
                      onChange={setWorkoutWhen}
                      wrap
                    />
                  </fieldset>
                  <fieldset className="onboarding-fieldset">
                    <legend>Where do you prefer to work out?</legend>
                    <ChoiceGrid
                      options={WORKOUT_WHERE}
                      value={workoutWhere}
                      onChange={setWorkoutWhere}
                    />
                  </fieldset>
                  <fieldset className="onboarding-fieldset">
                    <legend>What makes a workout enjoyable for you?</legend>
                    <ChoiceGrid
                      options={WORKOUT_ENJOY}
                      value={workoutEnjoy}
                      onChange={setWorkoutEnjoy}
                      wrap
                    />
                  </fieldset>
                </div>
              ) : null}

              {error ? (
                <p className="plan-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="plan-question-footer">
                <div className="plan-question-dots" aria-hidden>
                  {almostThere
                    ? Array.from({ length: 5 }, (_, index) => (
                        <span
                          key={index}
                          className={`plan-question-dot${
                            index === extraSection ? " is-active" : ""
                          }`}
                        />
                      ))
                    : Array.from({ length: CORE_TOTAL }, (_, index) => (
                        <span
                          key={index}
                          className={`plan-question-dot${
                            index === qIndex ? " is-active" : ""
                          }`}
                        />
                      ))}
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!canContinue}
                  onClick={onContinue}
                >
                  {qIndex === TOTAL_Q - 1 ? "See my plan →" : "Continue →"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {step === "review" && plan ? (
          <PlanReviewView
            plan={plan}
            focus={focus}
            equipment={equipment}
            style={style}
            error={error}
            toolbar={
              <div className="plan-review-toolbar">
                <button
                  type="button"
                  className="plan-back"
                  onClick={() => {
                    setSaveSuccess(false);
                    setQIndex(CORE_TOTAL - 1);
                    setStep("build");
                  }}
                >
                  ← Edit options
                </button>
              </div>
            }
            status={
              saveSuccess ? (
                <p className="plan-success" role="status">
                  Saved to your profile.{" "}
                  <Link href="/profile">View profile</Link> or{" "}
                  <Link href="/rooms">join a room</Link>.
                </p>
              ) : null
            }
            footer={
              <div className="plan-review-cta">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving || generating}
                  onClick={() => {
                    setSaveSuccess(false);
                    setError(null);
                    setQIndex(0);
                    setStep("build");
                  }}
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary-lg"
                  disabled={saving || saveSuccess}
                  onClick={onSaveClick}
                >
                  {saving ? "Saving…" : saveSuccess ? "Saved" : "Save Routine"}
                </button>
              </div>
            }
          />
        ) : null}
      </main>

      {comingSoonOpen ? (
        <div
          className="plan-modal-backdrop"
          role="presentation"
          onClick={() => setComingSoonOpen(false)}
        >
          <div
            className="plan-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-coming-soon-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="plan-coming-soon-title">Coming soon</h2>
            <p>
              Plan review will let you bring your own routine and get a
              RhoQ-ready version. We're still building it.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setComingSoonOpen(false)}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      {signUpOpen ? (
        <div
          className="plan-modal-backdrop"
          role="presentation"
          onClick={() => setSignUpOpen(false)}
        >
          <div
            className="plan-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-signup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="plan-signup-title">Sign up to save your routine</h2>
            <p>
              Create a free RhoQ account to keep this plan on your profile.
            </p>
            <div className="plan-modal-actions">
              <Link className="btn-primary" href="/login?next=/onboarding">
                Sign up
              </Link>
              <Link className="btn-secondary" href="/login?next=/onboarding">
                Log in
              </Link>
            </div>
            <button
              type="button"
              className="plan-modal-dismiss"
              onClick={() => setSignUpOpen(false)}
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
