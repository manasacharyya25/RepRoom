"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "@/app/landing.css";
import "@/app/onboarding.css";
import { Logo } from "@/components/brand/Logo";
import { completeOnboarding } from "@/lib/onboarding";
import {
  clearOnboardingDraft,
  readOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraft
} from "@/lib/onboarding-draft";
import { createClient } from "@/lib/supabase/client";
import { youtubeSearchUrl } from "@/lib/youtube-exercise";
import { buildStaticWorkoutPlan, type WorkoutPlan } from "@/lib/workout-plan";

const STEPS = [
  { id: "identity", label: "Profile" },
  { id: "context", label: "You" },
  { id: "goals", label: "Goals" },
  { id: "plan", label: "Plan" }
] as const;

const PLAN_STEP_INDEX = 3;

const OVERVIEW_ICONS = {
  goal: "🏔",
  style: "🏋",
  frequency: "📅",
  experience: "📈",
  split: "🔀",
  session: "⏱"
} as const;

export function OnboardingPlanPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [openSections, setOpenSections] = useState({
    warmup: true,
    progression: true,
    cooldown: false,
    notes: false
  });
  const [completedExercises, setCompletedExercises] = useState<
    Record<string, boolean>
  >({});
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>(
    {}
  );

  useEffect(() => {
    const existing = readOnboardingDraft();
    if (!existing || existing.workoutPlanStatus === "has_own") {
      router.replace("/onboarding");
      return;
    }

    setDraft(existing);

    const run = async () => {
      setLoading(true);
      await new Promise((resolve) => window.setTimeout(resolve, 1600));
      const generated =
        existing.workoutPlan ??
        buildStaticWorkoutPlan({
          primaryGoal: existing.primaryFitnessGoal || "build_muscle",
          experience: existing.fitnessExperience || "just_starting",
          daysPerWeek: existing.workoutDaysPerWeek ?? 3,
          sessionMinutes: existing.sessionMinutes ?? 60
        });
      const nextDraft = { ...existing, workoutPlan: generated };
      saveOnboardingDraft(nextDraft);
      setDraft(nextDraft);
      setPlan(generated);
      setActiveDay(0);
      setLoading(false);
    };

    void run();
  }, [router]);

  useEffect(() => {
    if (!plan) return;

    const names = [
      ...new Set(
        plan.weeklySchedule.flatMap((session) =>
          session.exercises.map((exercise) => exercise.exercise)
        )
      )
    ];
    let cancelled = false;

    const loadThumbnails = async () => {
      const entries = await Promise.all(
        names.map(async (name) => {
          try {
            const response = await fetch(
              `/api/youtube/thumbnail?q=${encodeURIComponent(name)}`
            );
            if (!response.ok) return [name, null] as const;
            const data = (await response.json()) as {
              thumbnailUrl?: string | null;
            };
            return [name, data.thumbnailUrl ?? null] as const;
          } catch {
            return [name, null] as const;
          }
        })
      );
      if (!cancelled) {
        setThumbnails(Object.fromEntries(entries));
      }
    };

    void loadThumbnails();
    return () => {
      cancelled = true;
    };
  }, [plan]);

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExercise = (key: string) => {
    setCompletedExercises((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const enterRhoq = async () => {
    if (!draft || !plan || saving) return;
    setSaving(true);
    setError(null);
    try {
      const timezone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "";

      await completeOnboarding(supabase, {
        displayName: draft.displayName,
        username: draft.username,
        bio: draft.bio,
        avatarUrl: draft.avatarUrl,
        avatarFile: null,
        ageRange: draft.ageRange,
        gender: draft.gender,
        activityLevel: draft.activityLevel,
        fitnessExperience: draft.fitnessExperience,
        countryCode: "",
        timezone,
        heightCm: draft.heightCm,
        currentWeightKg: draft.currentWeightKg,
        targetWeightKg: null,
        weightUnit: draft.weightUnit,
        primaryFitnessGoal: draft.primaryFitnessGoal,
        workoutDaysPerWeek: draft.workoutDaysPerWeek,
        sessionMinutes: draft.sessionMinutes,
        successMilestone: draft.successMilestone,
        workoutPlanStatus: draft.workoutPlanStatus,
        workoutPlan: plan,
        goals: draft.goals,
        skipped: false
      });

      clearOnboardingDraft();
      await fetch("/api/onboarding/complete-cookie", { method: "POST" }).catch(
        () => null
      );
      router.replace("/rooms");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save your plan. Please try again."
      );
      setSaving(false);
    }
  };

  const activeSession = plan?.weeklySchedule[activeDay] ?? null;

  return (
    <div className="onboarding-page">
      <header className="landing-nav onboarding-nav">
        <Logo />
      </header>

      <main className="onboarding-shell onboarding-shell--plan">
        <div className="onboarding-progress" aria-label="Onboarding progress">
          {STEPS.map((item, index) => (
            <div
              key={item.id}
              className={`onboarding-progress-step${
                index === PLAN_STEP_INDEX ? " is-active" : ""
              }${index < PLAN_STEP_INDEX ? " is-done" : ""}`}
            >
              <span className="onboarding-progress-dot" aria-hidden />
              <span className="onboarding-progress-label">{item.label}</span>
            </div>
          ))}
        </div>

        <section className="onboarding-card" aria-labelledby="onboarding-title">
          <header className="onboarding-card-head">
            <p className="onboarding-kicker">Step 4 of 4 · Plan</p>
            <h1 id="onboarding-title">Your personalized workout plan</h1>
            <p className="onboarding-lede">
              Built from your goal, experience, and schedule. Expand sections
              and browse each workout day.
            </p>
          </header>

          <div className="onboarding-plan-body">
            {loading || !plan ? (
              <div
                className="onboarding-plan-loading"
                role="status"
                aria-live="polite"
              >
                <div className="onboarding-plan-loading-spinner" aria-hidden />
                <strong>Generating your personalized routine…</strong>
                <p>
                  Matching your goal, schedule, and session length into a
                  starter plan.
                </p>
              </div>
            ) : (
              <>
                <section className="onboarding-plan-hero">
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <div className="onboarding-plan-overview-grid">
                    <article>
                      <span aria-hidden>{OVERVIEW_ICONS.goal}</span>
                      <div>
                        <small>Goal</small>
                        <strong>{plan.goal}</strong>
                      </div>
                    </article>
                    <article>
                      <span aria-hidden>{OVERVIEW_ICONS.style}</span>
                      <div>
                        <small>Style</small>
                        <strong>{plan.workoutStyle}</strong>
                      </div>
                    </article>
                    <article>
                      <span aria-hidden>{OVERVIEW_ICONS.frequency}</span>
                      <div>
                        <small>Frequency</small>
                        <strong>{plan.sessionsPerWeek}x / week</strong>
                      </div>
                    </article>
                    <article>
                      <span aria-hidden>{OVERVIEW_ICONS.experience}</span>
                      <div>
                        <small>Experience</small>
                        <strong>{plan.experience}</strong>
                      </div>
                    </article>
                    <article>
                      <span aria-hidden>{OVERVIEW_ICONS.split}</span>
                      <div>
                        <small>Split</small>
                        <strong>{plan.split}</strong>
                      </div>
                    </article>
                    <article>
                      <span aria-hidden>{OVERVIEW_ICONS.session}</span>
                      <div>
                        <small>Session</small>
                        <strong>~{plan.sessionDurationMinutes} min</strong>
                      </div>
                    </article>
                  </div>
                </section>

                <section className="onboarding-plan-block">
                  <button
                    type="button"
                    className="onboarding-plan-block-trigger"
                    aria-expanded={openSections.warmup}
                    onClick={() => toggleSection("warmup")}
                  >
                    <span>Warm-up · {plan.warmup.durationMinutes} min</span>
                    <span aria-hidden>
                      {openSections.warmup ? "▾" : "▸"}
                    </span>
                  </button>
                  {openSections.warmup ? (
                    <ol className="onboarding-plan-numbered">
                      {plan.warmup.steps.map((step, index) => (
                        <li key={step}>
                          <em>{index + 1}</em>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </section>

                <section className="onboarding-plan-workouts">
                  <div
                    className="onboarding-plan-tabs"
                    role="tablist"
                    aria-label="Weekly workouts"
                  >
                    {plan.weeklySchedule.map((session, index) => (
                      <button
                        key={session.day}
                        type="button"
                        role="tab"
                        aria-selected={activeDay === index}
                        className={
                          activeDay === index ? "is-active" : undefined
                        }
                        onClick={() => setActiveDay(index)}
                      >
                        {session.day}
                      </button>
                    ))}
                  </div>

                  {activeSession ? (
                    <div
                      className="onboarding-plan-exercise-cards"
                      role="tabpanel"
                    >
                      {activeSession.exercises.map((exercise) => {
                        const key = `${activeSession.day}-${exercise.exercise}`;
                        const done = Boolean(completedExercises[key]);
                        const restLabel = `${Math.floor(
                          exercise.restSeconds / 60
                        )
                          .toString()
                          .padStart(2, "0")}:${(exercise.restSeconds % 60)
                          .toString()
                          .padStart(2, "0")}`;
                        const searchUrl = youtubeSearchUrl(exercise.exercise);
                        const thumbnailUrl = thumbnails[exercise.exercise];
                        return (
                          <article
                            className={`onboarding-plan-exercise-card${
                              done ? " is-done" : ""
                            }`}
                            key={key}
                          >
                            <a
                              className="onboarding-plan-exercise-main"
                              href={searchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Search YouTube for ${exercise.exercise}`}
                            >
                              <div className="onboarding-plan-exercise-thumb">
                                {thumbnailUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={thumbnailUrl}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <span aria-hidden>▶</span>
                                )}
                              </div>
                              <div className="onboarding-plan-exercise-copy">
                                <strong>{exercise.exercise}</strong>
                                <p>
                                  {exercise.sets} sets × {exercise.reps}
                                </p>
                                <p>Rest {exercise.restSeconds}s</p>
                              </div>
                            </a>
                            <label
                              className="onboarding-plan-check"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={done}
                                onChange={() => toggleExercise(key)}
                              />
                              Check as completed
                            </label>
                            <div
                              className="onboarding-plan-rest-ring"
                              aria-label={`Rest ${restLabel}`}
                            >
                              <span>{restLabel}</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                </section>

                <section className="onboarding-plan-progression">
                  <button
                    type="button"
                    className="onboarding-plan-block-trigger onboarding-plan-block-trigger--plain"
                    aria-expanded={openSections.progression}
                    onClick={() => toggleSection("progression")}
                  >
                    <span>Progression · {plan.progression.method}</span>
                    <span aria-hidden>
                      {openSections.progression ? "▾" : "▸"}
                    </span>
                  </button>
                  {openSections.progression ? (
                    <ul className="onboarding-plan-progression-list">
                      {plan.progression.instructions.map((item, index) => (
                        <li key={item}>
                          <span aria-hidden>
                            {index === 0
                              ? "🏋"
                              : index === 1
                                ? "📈"
                                : index === 2
                                  ? "💪"
                                  : "🔄"}
                          </span>
                          <p>{item}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>

                <section className="onboarding-plan-block">
                  <button
                    type="button"
                    className="onboarding-plan-block-trigger"
                    aria-expanded={openSections.cooldown}
                    onClick={() => toggleSection("cooldown")}
                  >
                    <span>
                      Cool-down · {plan.cooldown.durationMinutes} min
                    </span>
                    <span aria-hidden>
                      {openSections.cooldown ? "▾" : "▸"}
                    </span>
                  </button>
                  {openSections.cooldown ? (
                    <ol className="onboarding-plan-numbered">
                      {plan.cooldown.steps.map((step, index) => (
                        <li key={step}>
                          <em>{index + 1}</em>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </section>

                <section className="onboarding-plan-block">
                  <button
                    type="button"
                    className="onboarding-plan-block-trigger"
                    aria-expanded={openSections.notes}
                    onClick={() => toggleSection("notes")}
                  >
                    <span>Notes</span>
                    <span aria-hidden>
                      {openSections.notes ? "▾" : "▸"}
                    </span>
                  </button>
                  {openSections.notes ? (
                    <ul className="onboarding-plan-notes">
                      {plan.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              </>
            )}
          </div>

          {error ? (
            <p className="onboarding-error" role="alert">
              {error}
            </p>
          ) : null}

          <footer className="onboarding-actions">
            <Link className="btn-secondary" href="/onboarding?step=plan">
              Back
            </Link>
            <div className="onboarding-actions-end">
              <button
                type="button"
                className="btn-primary"
                disabled={saving || loading || !plan}
                onClick={() => void enterRhoq()}
              >
                {saving ? "Saving…" : "Enter RhoQ"}
              </button>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
