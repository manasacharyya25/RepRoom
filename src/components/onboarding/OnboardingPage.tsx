"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import "@/app/landing.css";
import "@/app/onboarding.css";
import { Logo } from "@/components/brand/Logo";
import { uploadAvatar, validateAvatarFile } from "@/lib/avatar";
import { heightToCm, slugifyUsername, toKg } from "@/lib/goals";
import { completeOnboarding } from "@/lib/onboarding";
import {
  buildOnboardingGoalsFromDraft,
  saveOnboardingDraft
} from "@/lib/onboarding-draft";
import { LIVE_IMAGES } from "@/lib/live-images";
import { createClient } from "@/lib/supabase/client";
import type { WorkoutPlan, WorkoutPlanStatus } from "@/lib/workout-plan";

const STEPS = [
  { id: "identity", label: "Profile" },
  { id: "context", label: "You" },
  { id: "goals", label: "Goals" },
  { id: "plan", label: "Plan" }
] as const;

const BIO_TEMPLATES = [
  "Building strength one session at a time. Yoga · Cardio · Accountability.",
  "Here for the energy. Live rooms keep me consistent.",
  "Showing up, sweating, supporting — one day at a time."
];

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
  { value: "improve_endurance", emoji: "❤️", label: "Improve endurance" },
  { value: "more_flexible", emoji: "🧘", label: "Become more flexible" },
  { value: "stay_healthy", emoji: "🌱", label: "Stay healthy & active" },
  { value: "stay_consistent", emoji: "📅", label: "Stay consistent" }
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

const MILESTONE_EXAMPLES = [
  "Complete my first month without skipping",
  "Lose 5 kg",
  "Gain visible muscle",
  "Do my first pull-up",
  "Bench press 100 kg",
  "Run 5 km",
  "Touch my toes",
  "Just keep showing up"
] as const;

const PLAN_STATUS_OPTIONS = [
  {
    value: "has_own" as const,
    emoji: "✅",
    label: "Yes, I already follow one"
  },
  {
    value: "rough_idea" as const,
    emoji: "🤔",
    label: "I have a rough idea"
  },
  {
    value: "needs_plan" as const,
    emoji: "❌",
    label: "No, create one for me"
  }
] as const;

const DEFAULT_AVATARS = [
  LIVE_IMAGES.participant1,
  LIVE_IMAGES.participant2,
  LIVE_IMAGES.participant3,
  LIVE_IMAGES.participant4,
  LIVE_IMAGES.participant5,
  LIVE_IMAGES.participant6
];

function usernameSuggestions(displayName: string) {
  const base = slugifyUsername(displayName);
  if (!base) return ["athlete", "moves_daily", "show_up"];
  return [`${base}`, `${base}_moves`, `${base}_live`].filter(
    (value, index, list) => list.indexOf(value) === index
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const initialStep = (() => {
    const step = searchParams.get("step");
    if (step === "plan") return 3;
    if (step === "goals") return 2;
    if (step === "you" || step === "context") return 1;
    return 0;
  })();

  const [stepIndex, setStepIndex] = useState(initialStep);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATARS[3]);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [fitnessExperience, setFitnessExperience] = useState("");
  const [primaryFitnessGoal, setPrimaryFitnessGoal] = useState("");
  const [workoutDaysPerWeek, setWorkoutDaysPerWeek] = useState<number | null>(
    null
  );
  const [sessionMinutes, setSessionMinutes] = useState<number | null>(null);
  const [successMilestone, setSuccessMilestone] = useState("");
  const [workoutPlanStatus, setWorkoutPlanStatus] = useState<
    WorkoutPlanStatus | ""
  >("");
  const [heightFeet, setHeightFeet] = useState("5");
  const [heightInches, setHeightInches] = useState("11");
  const [heightCm, setHeightCm] = useState("180");
  const [heightUnit, setHeightUnit] = useState<"imperial" | "metric">("imperial");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [currentWeight, setCurrentWeight] = useState("95");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const suggestions = useMemo(
    () => usernameSuggestions(displayName || "you"),
    [displayName]
  );

  const activeAvatar = customAvatar ?? avatarUrl;
  const step = STEPS[stepIndex];

  const buildDraftPayload = (status: WorkoutPlanStatus) => {
    const weightNowRaw = Number.parseFloat(currentWeight);
    const height = heightToCm({
      unit: heightUnit,
      feet: Number.parseFloat(heightFeet) || 0,
      inches: Number.parseFloat(heightInches) || 0,
      cm: Number.parseFloat(heightCm) || 0
    });
    const goals = buildOnboardingGoalsFromDraft({
      primaryFitnessGoal,
      workoutDaysPerWeek,
      sessionMinutes,
      successMilestone
    });

    return {
      displayName: displayName.trim() || "Athlete",
      username: slugifyUsername(username) || slugifyUsername(displayName),
      bio,
      avatarUrl:
        customAvatar && !customAvatar.startsWith("blob:")
          ? customAvatar
          : activeAvatar,
      ageRange,
      gender,
      activityLevel,
      fitnessExperience,
      heightCm: Number.isFinite(height) && height > 0 ? height : null,
      currentWeightKg: Number.isFinite(weightNowRaw)
        ? toKg(weightNowRaw, weightUnit)
        : null,
      weightUnit,
      primaryFitnessGoal,
      workoutDaysPerWeek,
      sessionMinutes,
      successMilestone,
      workoutPlanStatus: status,
      workoutPlan: null as null,
      goals
    };
  };

  const finish = async (skipped: boolean) => {
    if (saving) return;

    if (!skipped && !validateIdentity()) {
      setStepIndex(0);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const draft = buildDraftPayload(
        workoutPlanStatus === "has_own" ? "has_own" : workoutPlanStatus || "has_own"
      );
      const timezone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "";

      await completeOnboarding(supabase, {
        ...draft,
        avatarFile,
        countryCode: "",
        timezone,
        targetWeightKg: null,
        workoutPlanStatus: skipped ? "" : draft.workoutPlanStatus,
        workoutPlan: null,
        goals: skipped ? [] : draft.goals,
        skipped
      });

      await fetch("/api/onboarding/complete-cookie", { method: "POST" }).catch(
        () => null
      );

      router.replace("/rooms");
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not save your profile. Please try again.";
      setError(
        message.includes("duplicate key") || message.includes("username")
          ? "That username is taken. Try another."
          : message
      );
    } finally {
      setSaving(false);
    }
  };

  const validateIdentity = () => {
    if (!displayName.trim()) {
      setError("Tell us what to call you.");
      return false;
    }
    const handle = slugifyUsername(username);
    if (!handle || handle.length < 3) {
      setError("Username needs at least 3 characters.");
      return false;
    }
    setUsername(handle);
    setError(null);
    return true;
  };

  const goNext = () => {
    if (avatarUploading) {
      setError("Wait for your photo to finish uploading.");
      return;
    }
    if (stepIndex === 0 && !validateIdentity()) return;

    if (step.id === "plan") {
      if (!workoutPlanStatus) {
        setError("Tell us whether you already have a workout plan.");
        return;
      }

      if (workoutPlanStatus === "has_own") {
        void finish(false);
        return;
      }

      if (!validateIdentity()) {
        setStepIndex(0);
        return;
      }

      void generateAndOpenPlan();
      return;
    }

    if (stepIndex >= STEPS.length - 1) {
      void finish(false);
      return;
    }
    setError(null);
    setStepIndex((index) => index + 1);
  };

  const generateAndOpenPlan = async () => {
    if (generatingPlan || saving) return;
    setGeneratingPlan(true);
    setError(null);

    try {
      const draft = buildDraftPayload(workoutPlanStatus as WorkoutPlanStatus);
      saveOnboardingDraft(draft);

      const response = await fetch("/api/workout-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryGoal: draft.primaryFitnessGoal || "build_muscle",
          fitnessExperience: draft.fitnessExperience || "just_starting",
          daysPerWeek: draft.workoutDaysPerWeek ?? 3,
          sessionMinutes: draft.sessionMinutes ?? 60
        })
      });

      const payload = (await response.json().catch(() => null)) as {
        plan?: unknown;
        error?: string;
      } | null;

      if (!response.ok || !payload?.plan) {
        throw new Error(
          payload?.error || "Could not generate your workout plan."
        );
      }

      saveOnboardingDraft({
        ...draft,
        workoutPlan: payload.plan as WorkoutPlan
      });
      router.push("/onboarding/plan");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not generate your workout plan."
      );
      setGeneratingPlan(false);
    }
  };

  const goBack = () => {
    setError(null);
    setStepIndex((index) => Math.max(0, index - 1));
  };

  const selectPlanStatus = (status: WorkoutPlanStatus) => {
    setError(null);
    setWorkoutPlanStatus(status);
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (customAvatar?.startsWith("blob:")) {
      URL.revokeObjectURL(customAvatar);
    }

    const previewUrl = URL.createObjectURL(file);
    setCustomAvatar(previewUrl);
    setAvatarFile(file);
    setError(null);
    setAvatarUploading(true);

    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Sign in again to upload a photo.");

      const publicUrl = await uploadAvatar(supabase, user.id, file);
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      setCustomAvatar(publicUrl);
      setAvatarUrl(publicUrl);
      setAvatarFile(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not upload your photo. Try again."
      );
      // Keep local preview + file so finish() can retry upload
      setAvatarFile(file);
    } finally {
      setAvatarUploading(false);
    }
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
    const convert = (value: string) => {
      const amount = Number.parseFloat(value);
      if (!Number.isFinite(amount)) return value;
      const converted = next === "kg" ? lbsToKg(amount) : toLbs(amount);
      return String(Math.round(converted * 10) / 10);
    };
    setCurrentWeight((value) => convert(value));
    setWeightUnit(next);
  };

  const switchHeightUnit = (next: "imperial" | "metric") => {
    if (next === heightUnit) return;
    if (next === "metric") {
      const feet = Number.parseFloat(heightFeet) || 0;
      const inches = Number.parseFloat(heightInches) || 0;
      const totalInches = feet * 12 + inches;
      setHeightCm(String(Math.round(totalInches * 2.54)));
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

  return (
    <div className="onboarding-page">
      <header className="landing-nav onboarding-nav">
        <Logo />
        <div className="landing-nav-actions">
          <button
            type="button"
            className="btn-ghost onboarding-skip"
            disabled={saving}
            onClick={() => {
              void finish(true);
            }}
          >
            Skip for now
          </button>
        </div>
      </header>

      <main className="onboarding-shell">
        <div className="onboarding-progress" aria-label="Onboarding progress">
          {STEPS.map((item, index) => (
            <div
              key={item.id}
              className={`onboarding-progress-step${
                index === stepIndex ? " is-active" : ""
              }${index < stepIndex ? " is-done" : ""}`}
            >
              <span className="onboarding-progress-dot" aria-hidden />
              <span className="onboarding-progress-label">{item.label}</span>
            </div>
          ))}
        </div>

        <section className="onboarding-card" aria-labelledby="onboarding-title">
          {step.id === "identity" ? (
            <>
              <header className="onboarding-card-head">
                <p className="onboarding-kicker">Step 1 of 4 · Profile</p>
                <h1 id="onboarding-title">Set up your presence</h1>
                <p className="onboarding-lede">
                  This is how you’ll show up in live rooms and on the feed.
                </p>
              </header>

              <div className="onboarding-avatar-row">
                <div className="onboarding-avatar-preview">
                  <Image
                    alt=""
                    className="onboarding-avatar-image"
                    fill
                    sizes="96px"
                    src={activeAvatar}
                    unoptimized={
                      activeAvatar.startsWith("blob:") ||
                      activeAvatar.includes("supabase.co")
                    }
                  />
                  {avatarUploading ? (
                    <span className="onboarding-avatar-uploading">Uploading…</span>
                  ) : null}
                </div>
                <div className="onboarding-avatar-actions">
                  <p className="onboarding-field-label">Add a profile photo</p>
                  <div className="onboarding-avatar-options">
                    {DEFAULT_AVATARS.map((src) => (
                      <button
                        key={src}
                        type="button"
                        className={`onboarding-avatar-choice${
                          !customAvatar && avatarUrl === src ? " is-selected" : ""
                        }`}
                        aria-label="Choose default avatar"
                        disabled={avatarUploading || saving}
                        onClick={() => {
                          if (customAvatar?.startsWith("blob:")) {
                            URL.revokeObjectURL(customAvatar);
                          }
                          setCustomAvatar(null);
                          setAvatarFile(null);
                          setAvatarUrl(src);
                          setError(null);
                        }}
                      >
                        <Image
                          alt=""
                          className="onboarding-avatar-choice-image"
                          fill
                          sizes="44px"
                          src={src}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="onboarding-upload-row">
                    <button
                      type="button"
                      className="btn-secondary onboarding-upload"
                      disabled={avatarUploading || saving}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {avatarUploading
                        ? "Uploading…"
                        : customAvatar
                          ? "Change photo"
                          : "Upload photo"}
                    </button>
                    {customAvatar ? (
                      <button
                        type="button"
                        className="btn-ghost onboarding-upload-clear"
                        disabled={avatarUploading || saving}
                        onClick={() => {
                          if (customAvatar.startsWith("blob:")) {
                            URL.revokeObjectURL(customAvatar);
                          }
                          setCustomAvatar(null);
                          setAvatarFile(null);
                          setAvatarUrl(DEFAULT_AVATARS[3]);
                          setError(null);
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {customAvatar && !avatarUploading ? (
                    <p className="onboarding-upload-status">
                      Custom photo ready
                    </p>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    type="file"
                    onChange={(event) => {
                      void onPickFile(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                </div>
              </div>

              <label className="onboarding-field">
                <span>What should we call you?</span>
                <input
                  autoComplete="nickname"
                  maxLength={40}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDisplayName(value);
                    if (!username || username === slugifyUsername(displayName)) {
                      setUsername(slugifyUsername(value));
                    }
                  }}
                  placeholder="First name or nickname"
                  type="text"
                  value={displayName}
                />
              </label>

              <label className="onboarding-field">
                <span>Claim your unique username</span>
                <div className="onboarding-username">
                  <span aria-hidden>@</span>
                  <input
                    autoComplete="username"
                    maxLength={20}
                    onChange={(event) =>
                      setUsername(slugifyUsername(event.target.value))
                    }
                    placeholder="username"
                    type="text"
                    value={username}
                  />
                </div>
              </label>

              {suggestions.length > 0 ? (
                <div className="onboarding-chips" aria-label="Username suggestions">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="onboarding-chip"
                      onClick={() => setUsername(suggestion)}
                    >
                      @{suggestion}
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="onboarding-field">
                <span>Tell the community a bit about yourself</span>
                <textarea
                  maxLength={160}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder={BIO_TEMPLATES[0]}
                  rows={3}
                  value={bio}
                />
              </label>

              <div className="onboarding-chips" aria-label="Bio templates">
                {BIO_TEMPLATES.map((template, index) => (
                  <button
                    key={template}
                    type="button"
                    className={`onboarding-chip${bio === template ? " is-selected" : ""}`}
                    onClick={() => setBio(template)}
                  >
                    {index === 0
                      ? "Strength & accountability"
                      : index === 1
                        ? "Live room energy"
                        : "Show up daily"}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step.id === "context" ? (
            <>
              <header className="onboarding-card-head">
                <p className="onboarding-kicker">Step 2 of 4 · You</p>
                <h1 id="onboarding-title">Help us personalize rooms</h1>
                <p className="onboarding-lede">
                  Optional — used for recommendations and matching.
                </p>
              </header>

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
                <legend>
                  Gender <span className="onboarding-optional">(optional)</span>
                </legend>
                <div className="onboarding-option-grid">
                  {GENDERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`onboarding-option-card${
                        gender === option.value ? " is-selected" : ""
                      }`}
                      onClick={() =>
                        setGender((current) =>
                          current === option.value ? "" : option.value
                        )
                      }
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
                          onChange={(event) => setHeightFeet(event.target.value)}
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
                          onChange={(event) => setHeightCm(event.target.value)}
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
                <legend>Activity level</legend>
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

              <fieldset className="onboarding-fieldset">
                <legend>Experience</legend>
                <div className="onboarding-option-grid">
                  {FITNESS_EXPERIENCE.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`onboarding-option-card${
                        fitnessExperience === option.value ? " is-selected" : ""
                      }`}
                      onClick={() => setFitnessExperience(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          {step.id === "goals" ? (
            <>
              <header className="onboarding-card-head">
                <p className="onboarding-kicker">Step 3 of 4 · Goals</p>
                <h1 id="onboarding-title">🎯 What&apos;s your primary fitness goal?</h1>
                <p className="onboarding-lede">Choose one. You can refine this later.</p>
              </header>

              <fieldset className="onboarding-fieldset">
                <legend className="sr-only">Primary fitness goal</legend>
                <div className="onboarding-option-grid onboarding-option-grid--goals">
                  {PRIMARY_GOALS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`onboarding-option-card onboarding-option-card--goal${
                        primaryFitnessGoal === option.value ? " is-selected" : ""
                      }`}
                      onClick={() => setPrimaryFitnessGoal(option.value)}
                    >
                      <span className="onboarding-option-emoji" aria-hidden>
                        {option.emoji}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="onboarding-fieldset">
                <legend>📆 How often do you want to work out?</legend>
                <div className="onboarding-option-grid onboarding-option-grid--wrap">
                  {WORKOUT_FREQUENCY.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`onboarding-option-card${
                        workoutDaysPerWeek === option.value ? " is-selected" : ""
                      }`}
                      onClick={() => setWorkoutDaysPerWeek(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="onboarding-fieldset">
                <legend>⏱️ How long can you commit per session?</legend>
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
              </fieldset>

              <fieldset className="onboarding-fieldset">
                <legend>🏁 What milestone would make you feel successful?</legend>
                <label className="onboarding-field">
                  <span className="sr-only">Your milestone</span>
                  <textarea
                    rows={3}
                    placeholder="Write your own, or pick an example below"
                    value={successMilestone}
                    onChange={(event) => setSuccessMilestone(event.target.value)}
                  />
                </label>
                <div className="onboarding-chip-row" role="group" aria-label="Milestone examples">
                  {MILESTONE_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className={`onboarding-chip${
                        successMilestone === example ? " is-selected" : ""
                      }`}
                      onClick={() => setSuccessMilestone(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          {step.id === "plan" ? (
            <>
              <header className="onboarding-card-head">
                <p className="onboarding-kicker">Step 4 of 4 · Plan</p>
                <h1 id="onboarding-title">Do you already have a workout plan?</h1>
                <p className="onboarding-lede">
                  If you already follow one, jump into RhoQ. Otherwise we&apos;ll
                  generate a personalized starter routine from your goals.
                </p>
              </header>

              <fieldset className="onboarding-fieldset">
                <legend className="sr-only">Workout plan status</legend>
                <div className="onboarding-option-grid onboarding-option-grid--goals">
                  {PLAN_STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`onboarding-option-card onboarding-option-card--goal${
                        workoutPlanStatus === option.value ? " is-selected" : ""
                      }`}
                      disabled={saving || generatingPlan}
                      onClick={() => selectPlanStatus(option.value)}
                    >
                      <span className="onboarding-option-emoji" aria-hidden>
                        {option.emoji}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {generatingPlan ? (
                <div
                  className="onboarding-plan-loading"
                  role="status"
                  aria-live="polite"
                >
                  <div className="onboarding-plan-loading-spinner" aria-hidden />
                  <strong>Generating your personalized routine…</strong>
                  <p>
                    Building a starter plan from your goal, experience, schedule,
                    and session length.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          {error ? (
            <p className="onboarding-error" role="alert">
              {error}
            </p>
          ) : null}

          <footer className="onboarding-actions">
            {stepIndex > 0 ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={saving || generatingPlan}
                onClick={goBack}
              >
                Back
              </button>
            ) : (
              <span />
            )}
            <div className="onboarding-actions-end">
              {stepIndex < STEPS.length - 1 ? (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={saving || generatingPlan}
                  onClick={() => {
                    setError(null);
                    setStepIndex((index) => index + 1);
                  }}
                >
                  Skip step
                </button>
              ) : null}
              <button
                type="button"
                className="btn-primary"
                disabled={
                  saving ||
                  generatingPlan ||
                  (step.id === "plan" && !workoutPlanStatus)
                }
                onClick={goNext}
              >
                {saving
                  ? "Saving…"
                  : generatingPlan
                    ? "Generating…"
                    : step.id === "plan"
                      ? !workoutPlanStatus
                        ? "Next"
                        : workoutPlanStatus === "has_own"
                          ? "Enter RhoQ"
                          : "Generate my workout plan"
                      : stepIndex >= STEPS.length - 1
                        ? "Enter RhoQ"
                        : "Continue"}
              </button>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
