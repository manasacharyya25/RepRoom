"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import "@/app/landing.css";
import "@/app/onboarding.css";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { uploadAvatar, validateAvatarFile } from "@/lib/avatar";
import { heightToCm, hoursGoalTarget, slugifyUsername, toKg } from "@/lib/goals";
import { completeOnboarding } from "@/lib/onboarding";
import { LIVE_IMAGES } from "@/lib/live-images";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingGoalInput } from "@/lib/types/profile";

const STEPS = [
  { id: "identity", label: "Profile" },
  { id: "context", label: "You" },
  { id: "goals", label: "Goals" }
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

const REGIONS = [
  { value: "in", label: "India" },
  { value: "us", label: "United States" },
  { value: "gb", label: "United Kingdom" },
  { value: "ca", label: "Canada" },
  { value: "au", label: "Australia" },
  { value: "sg", label: "Singapore" },
  { value: "ae", label: "United Arab Emirates" },
  { value: "other", label: "Somewhere else" }
] as const;

const DEFAULT_AVATARS = [
  LIVE_IMAGES.participant1,
  LIVE_IMAGES.participant2,
  LIVE_IMAGES.participant3,
  LIVE_IMAGES.participant4,
  LIVE_IMAGES.participant5,
  LIVE_IMAGES.participant6
];

const STREAK_TARGETS = [10, 20, 30] as const;

function usernameSuggestions(displayName: string) {
  const base = slugifyUsername(displayName);
  if (!base) return ["athlete", "moves_daily", "show_up"];
  return [`${base}`, `${base}_moves`, `${base}_live`].filter(
    (value, index, list) => list.indexOf(value) === index
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const [stepIndex, setStepIndex] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATARS[3]);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [ageRange, setAgeRange] = useState("");
  const [region, setRegion] = useState("");
  const [trainCurrentDays, setTrainCurrentDays] = useState("5");
  const [trainExpectedDays, setTrainExpectedDays] = useState("5");
  const [streakCurrent, setStreakCurrent] = useState("8");
  const [streakTarget, setStreakTarget] = useState(30);
  const [liftTarget, setLiftTarget] = useState("100");
  const [liftCurrent, setLiftCurrent] = useState("95");
  const [caloriesTarget, setCaloriesTarget] = useState("1800");
  const [caloriesCurrent, setCaloriesCurrent] = useState("1750");
  const [heightFeet, setHeightFeet] = useState("5");
  const [heightInches, setHeightInches] = useState("11");
  const [heightCm, setHeightCm] = useState("180");
  const [heightUnit, setHeightUnit] = useState<"imperial" | "metric">("imperial");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [currentWeight, setCurrentWeight] = useState("95");
  const [targetWeight, setTargetWeight] = useState("85");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(
    () => usernameSuggestions(displayName || "you"),
    [displayName]
  );

  const activeAvatar = customAvatar ?? avatarUrl;
  const step = STEPS[stepIndex];

  const buildGoals = (): OnboardingGoalInput[] => {
    const trainCurrent = Number.parseFloat(trainCurrentDays) || 0;
    const trainExpected = Number.parseFloat(trainExpectedDays) || 5;
    const streakNow = Number.parseFloat(streakCurrent) || 0;
    const liftNow = Number.parseFloat(liftCurrent) || 0;
    const liftGoal = Number.parseFloat(liftTarget) || 0;
    const calNow = Number.parseFloat(caloriesCurrent) || 0;
    const calGoal = Number.parseFloat(caloriesTarget) || 0;
    const weightNowRaw = Number.parseFloat(currentWeight) || 0;
    const weightGoalRaw = Number.parseFloat(targetWeight) || 0;
    const weightNow = toKg(weightNowRaw, weightUnit);
    const weightGoal = toKg(weightGoalRaw, weightUnit);
    const hoursCurrent = 0;
    const hoursTarget = hoursGoalTarget(hoursCurrent);

    return [
      {
        template_id: "train_weekly",
        title: "Train 5 days a week",
        detail: "Consistency over perfection",
        category: "consistency",
        current_value: trainCurrent,
        target_value: trainExpected,
        unit: "days",
        sort_order: 0
      },
      {
        template_id: "mobility_streak",
        title: "Morning mobility streak",
        detail: "Build a daily habit",
        category: "consistency",
        current_value: streakNow,
        target_value: streakTarget,
        unit: "days",
        sort_order: 1
      },
      {
        template_id: "lift_target",
        title: "Hit a lift target",
        detail: "Track a milestone PR",
        category: "performance",
        current_value: liftNow,
        target_value: liftGoal,
        unit: "kg",
        sort_order: 2
      },
      {
        template_id: "meal_prep",
        title: "Meal Prep & Nutrition",
        detail: "Wins between workouts",
        category: "lifestyle",
        current_value: calNow,
        target_value: calGoal,
        unit: "kcal",
        sort_order: 3
      },
      {
        template_id: "target_weight",
        title: "Hit target weight",
        detail: "Track toward your goal weight",
        category: "lifestyle",
        current_value: weightNow,
        target_value: weightGoal,
        unit: "kg",
        sort_order: 4
      },
      {
        template_id: "hours_worked",
        title: "Hours worked",
        detail: "Time in live rooms",
        category: "consistency",
        current_value: hoursCurrent,
        target_value: hoursTarget,
        unit: "hours",
        sort_order: 5
      }
    ];
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
      const weightNowRaw = Number.parseFloat(currentWeight);
      const weightGoalRaw = Number.parseFloat(targetWeight);
      const height = heightToCm({
        unit: heightUnit,
        feet: Number.parseFloat(heightFeet) || 0,
        inches: Number.parseFloat(heightInches) || 0,
        cm: Number.parseFloat(heightCm) || 0
      });

      const timezone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "";

      await completeOnboarding(supabase, {
        displayName: displayName.trim() || (skipped ? "Athlete" : ""),
        username: slugifyUsername(username) || slugifyUsername(displayName),
        bio,
        avatarUrl: customAvatar && !customAvatar.startsWith("blob:")
          ? customAvatar
          : activeAvatar,
        avatarFile,
        ageRange,
        countryCode: region,
        timezone,
        heightCm: Number.isFinite(height) && height > 0 ? height : null,
        currentWeightKg: Number.isFinite(weightNowRaw)
          ? toKg(weightNowRaw, weightUnit)
          : null,
        targetWeightKg: Number.isFinite(weightGoalRaw)
          ? toKg(weightGoalRaw, weightUnit)
          : null,
        weightUnit,
        goals: skipped ? [] : buildGoals(),
        skipped
      });

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
    if (stepIndex >= STEPS.length - 1) {
      void finish(false);
      return;
    }
    setError(null);
    setStepIndex((index) => index + 1);
  };

  const goBack = () => {
    setError(null);
    setStepIndex((index) => Math.max(0, index - 1));
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
    setTargetWeight((value) => convert(value));
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
        <Link className="landing-logo" href="/">
          <span className="landing-logo-mark" aria-hidden>
            S
          </span>
          Satara
        </Link>
        <div className="landing-nav-actions">
          <ThemeSwitch />
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
                <p className="onboarding-kicker">Step 1 of 3 · Profile</p>
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
                <p className="onboarding-kicker">Step 2 of 3 · You</p>
                <h1 id="onboarding-title">Help us personalize rooms</h1>
                <p className="onboarding-lede">
                  Optional — used for recommendations and local live timings.
                </p>
              </header>

              <fieldset className="onboarding-fieldset">
                <legend>How old are you?</legend>
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

              <label className="onboarding-field">
                <span>Where are you working out from?</span>
                <select
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                >
                  <option value="">Select country / region</option>
                  {REGIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {step.id === "goals" ? (
            <>
              <header className="onboarding-card-head">
                <p className="onboarding-kicker">Step 3 of 3 · Goals</p>
                <h1 id="onboarding-title">What are you chasing?</h1>
                <p className="onboarding-lede">
                  Set a few targets to seed your accountability board. You can
                  change these anytime.
                </p>
              </header>

              <div className="onboarding-goal-layout">
                <article className="onboarding-goal-panel">
                  <p className="onboarding-goal-category">Consistency</p>
                  <strong className="onboarding-goal-title">
                    Train 5 days a week
                  </strong>
                  <p className="onboarding-goal-detail">
                    Consistency over perfection
                  </p>
                  <div className="onboarding-goal-fields onboarding-goal-fields--row">
                    <label className="onboarding-metric">
                      <span>Current (days)</span>
                      <input
                        inputMode="numeric"
                        onChange={(event) =>
                          setTrainCurrentDays(event.target.value)
                        }
                        type="text"
                        value={trainCurrentDays}
                      />
                    </label>
                    <label className="onboarding-metric">
                      <span>Expected (days)</span>
                      <input
                        inputMode="numeric"
                        onChange={(event) =>
                          setTrainExpectedDays(event.target.value)
                        }
                        type="text"
                        value={trainExpectedDays}
                      />
                    </label>
                  </div>
                </article>

                <article className="onboarding-goal-panel">
                  <p className="onboarding-goal-category">Consistency</p>
                  <strong className="onboarding-goal-title">
                    Morning mobility streak
                  </strong>
                  <p className="onboarding-goal-detail">Build a daily habit</p>
                  <div className="onboarding-streak-meta">
                    <label className="onboarding-streak-line">
                      <span>Current Streak (days):</span>
                      <input
                        inputMode="numeric"
                        onChange={(event) => setStreakCurrent(event.target.value)}
                        type="text"
                        value={streakCurrent}
                      />
                    </label>
                    <span>Target Streak (days): {streakTarget}</span>
                  </div>
                  <div
                    className="onboarding-segmented"
                    role="group"
                    aria-label="Target streak"
                  >
                    {STREAK_TARGETS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={
                          streakTarget === days ? "is-selected" : undefined
                        }
                        onClick={() => setStreakTarget(days)}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </article>

                <article className="onboarding-goal-panel">
                  <p className="onboarding-goal-category">Performance</p>
                  <strong className="onboarding-goal-title">
                    Hit a lift target
                  </strong>
                  <p className="onboarding-goal-detail">Track a milestone PR</p>
                  <div className="onboarding-goal-fields onboarding-goal-fields--row">
                    <label className="onboarding-metric">
                      <span>Current (kg)</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) => setLiftCurrent(event.target.value)}
                        type="text"
                        value={liftCurrent}
                      />
                    </label>
                    <label className="onboarding-metric">
                      <span>Target (kg)</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) => setLiftTarget(event.target.value)}
                        type="text"
                        value={liftTarget}
                      />
                    </label>
                  </div>
                </article>

                <article className="onboarding-goal-panel">
                  <p className="onboarding-goal-category">Lifestyle</p>
                  <strong className="onboarding-goal-title">
                    Meal Prep &amp; Nutrition
                  </strong>
                  <p className="onboarding-goal-detail">
                    Wins between workouts
                  </p>
                  <div className="onboarding-goal-fields">
                    <label className="onboarding-metric">
                      <span>Current Daily Calorie Intake</span>
                      <input
                        inputMode="numeric"
                        onChange={(event) =>
                          setCaloriesCurrent(event.target.value)
                        }
                        type="text"
                        value={caloriesCurrent}
                      />
                    </label>
                    <label className="onboarding-metric">
                      <span>Target Daily Calorie Intake</span>
                      <input
                        inputMode="numeric"
                        onChange={(event) =>
                          setCaloriesTarget(event.target.value)
                        }
                        type="text"
                        value={caloriesTarget}
                      />
                    </label>
                  </div>
                </article>

                <article className="onboarding-goal-panel onboarding-goal-panel--wide">
                  <div className="onboarding-biometrics-head">
                    <div>
                      <p className="onboarding-goal-category">Biometrics</p>
                      <strong className="onboarding-goal-title">
                        Baseline measurements
                      </strong>
                      <p className="onboarding-goal-detail">
                        Track your starting stats for accurate progress
                      </p>
                    </div>
                  </div>

                  <div className="onboarding-biometrics">
                    <div className="onboarding-biometrics-group">
                      <div className="onboarding-biometrics-label-row">
                        <span className="onboarding-biometrics-label">
                          Current height
                        </span>
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

                      <div className="onboarding-weight-grid">
                        <label className="onboarding-weight-field">
                          <span>Current</span>
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

                        <label className="onboarding-weight-field">
                          <span>Target</span>
                          <div className="onboarding-measure-control">
                            <div className="onboarding-measure-slot onboarding-measure-slot--grow">
                              <input
                                inputMode="decimal"
                                onChange={(event) =>
                                  setTargetWeight(event.target.value)
                                }
                                type="text"
                                value={targetWeight}
                              />
                              <span>{weightUnit}</span>
                            </div>
                          </div>
                          <em className="onboarding-weight-hint">
                            ≈ {convertWeightDisplay(targetWeight, weightUnit)}
                          </em>
                        </label>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
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
                disabled={saving}
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
                  disabled={saving}
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
                disabled={saving}
                onClick={goNext}
              >
                {saving
                  ? "Saving…"
                  : stepIndex >= STEPS.length - 1
                    ? "Enter Satara"
                    : "Continue"}
              </button>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
