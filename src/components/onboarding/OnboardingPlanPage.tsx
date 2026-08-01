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
import {
  activityTotalSeconds,
  activityYoutubeQuery,
  formatSecondsClock,
  isAddOnActivity,
  normalizeWorkoutPlan,
  scalePlanToSessionDuration,
  sessionDurationMinutes,
  warmupActivities,
  warmupDurationSeconds,
  workoutListActivities,
  workoutTabLabel,
  type WorkoutPlan
} from "@/lib/workout-plan";
import { humanizePlanLabel } from "@/lib/workout-plan-seed";

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
  const [openSection, setOpenSection] = useState<"warmup" | "workouts" | null>(
    "workouts"
  );
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
      setError(null);
      try {
        const existingPlan = normalizeWorkoutPlan(existing.workoutPlan);
        if (existingPlan) {
          const scaled = scalePlanToSessionDuration(existingPlan);
          setPlan(scaled);
          setActiveDay(0);
          setLoading(false);
          return;
        }

        // Plan should already be generated on step 4; if missing, fetch once.
        const response = await fetch("/api/workout-plan/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primaryGoal: existing.primaryFitnessGoal || "build_muscle",
            fitnessExperience: existing.fitnessExperience || "just_starting",
            daysPerWeek: existing.workoutDaysPerWeek ?? 3,
            sessionMinutes: existing.sessionMinutes ?? 60
          })
        });

        const payload = (await response.json().catch(() => null)) as {
          plan?: WorkoutPlan;
          error?: string;
        } | null;

        if (!response.ok || !payload?.plan) {
          throw new Error(
            payload?.error || "Could not generate your workout plan."
          );
        }

        const generated =
          scalePlanToSessionDuration(
            normalizeWorkoutPlan(payload.plan) ?? payload.plan
          );
        const nextDraft = { ...existing, workoutPlan: generated };
        saveOnboardingDraft(nextDraft);
        setDraft(nextDraft);
        setPlan(generated);
        setActiveDay(0);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not generate your workout plan."
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [router]);

  useEffect(() => {
    if (!plan) return;

    const queries = [
      ...new Set(
        plan.days.flatMap((day) =>
          day.activities
            .map((item) => activityYoutubeQuery(item))
            .filter((value): value is string => Boolean(value))
        )
      )
    ];
    let cancelled = false;

    const loadThumbnails = async () => {
      const entries = await Promise.all(
        queries.map(async (query) => {
          try {
            const response = await fetch(
              `/api/youtube/thumbnail?q=${encodeURIComponent(query)}`
            );
            if (!response.ok) return [query, null] as const;
            const data = (await response.json()) as {
              thumbnailUrl?: string | null;
            };
            return [query, data.thumbnailUrl ?? null] as const;
          } catch {
            return [query, null] as const;
          }
        })
      );
      if (!cancelled) setThumbnails(Object.fromEntries(entries));
    };

    void loadThumbnails();
    return () => {
      cancelled = true;
    };
  }, [plan]);

  const toggleSection = (section: "warmup" | "workouts") => {
    setOpenSection((current) => (current === section ? null : section));
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

  const activeSession = plan?.days[activeDay] ?? null;
  const activeWarmups = activeSession ? warmupActivities(activeSession) : [];

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
                  Building a starter plan from your goal, experience, schedule,
                  and session length.
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
                        <strong>{humanizePlanLabel(plan.goal)}</strong>
                      </div>
                    </article>
                    <article>
                      <span aria-hidden>{OVERVIEW_ICONS.style}</span>
                      <div>
                        <small>Style</small>
                        <strong>{humanizePlanLabel(plan.workoutStyle)}</strong>
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
                        <strong>{humanizePlanLabel(plan.experience)}</strong>
                      </div>
                    </article>
                    <article>
                      <span aria-hidden>{OVERVIEW_ICONS.split}</span>
                      <div>
                        <small>Split</small>
                        <strong>{humanizePlanLabel(plan.split)}</strong>
                      </div>
                    </article>
                    <article>
                      <span aria-hidden>{OVERVIEW_ICONS.session}</span>
                      <div>
                        <small>Session</small>
                        <strong>~{sessionDurationMinutes(plan)} min</strong>
                      </div>
                    </article>
                  </div>
                </section>

                <section className="onboarding-plan-block">
                  <button
                    type="button"
                    className="onboarding-plan-block-trigger"
                    aria-expanded={openSection === "warmup"}
                    onClick={() => toggleSection("warmup")}
                  >
                    <span>
                      Warm-up
                      {activeSession
                        ? ` · ${Math.max(
                            1,
                            Math.round(warmupDurationSeconds(activeSession) / 60)
                          )} min`
                        : ""}
                    </span>
                    <span aria-hidden>
                      {openSection === "warmup" ? "▾" : "▸"}
                    </span>
                  </button>
                  {openSection === "warmup" ? (
                    <div className="onboarding-plan-exercise-cards">
                      {activeWarmups.map((item, index) => {
                        const query = activityYoutubeQuery(item);
                        const searchUrl = query
                          ? youtubeSearchUrl(query)
                          : null;
                        const thumbnailUrl = query
                          ? thumbnails[query]
                          : null;
                        const totalSeconds = activityTotalSeconds(item);
                        const clock = formatSecondsClock(totalSeconds);
                        return (
                          <article
                            className="onboarding-plan-exercise-card onboarding-plan-exercise-card--no-check"
                            key={`${item.name}-${index}`}
                          >
                            {searchUrl ? (
                              <a
                                className="onboarding-plan-exercise-main"
                                href={searchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Search YouTube for ${item.name}`}
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
                                  <strong>{item.name}</strong>
                                  <p>
                                    {item.sets ? `${item.sets} sets` : null}
                                    {item.sets && item.reps ? " × " : null}
                                    {item.reps}
                                  </p>
                                  <p className="onboarding-plan-exercise-duration">
                                    {clock}
                                  </p>
                                </div>
                              </a>
                            ) : (
                              <div className="onboarding-plan-exercise-main">
                                <div className="onboarding-plan-exercise-thumb">
                                  <span aria-hidden>▶</span>
                                </div>
                                <div className="onboarding-plan-exercise-copy">
                                  <strong>{item.name}</strong>
                                  {item.reps ? <p>{item.reps}</p> : null}
                                  <p className="onboarding-plan-exercise-duration">
                                    {clock}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div
                              className="onboarding-plan-rest-ring"
                              aria-label={`Duration ${clock}`}
                            >
                              <span>{clock}</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                </section>

                <section className="onboarding-plan-workouts">
                  <div
                    className="onboarding-plan-tabs"
                    role="tablist"
                    aria-label="Weekly workouts"
                  >
                    {plan.days.map((day, index) => (
                      <button
                        key={day.day}
                        type="button"
                        role="tab"
                        aria-selected={activeDay === index}
                        className={
                          activeDay === index ? "is-active" : undefined
                        }
                        onClick={() => setActiveDay(index)}
                      >
                        {workoutTabLabel(day, index)}
                      </button>
                    ))}
                  </div>

                  {activeSession ? (
                    <div
                      className="onboarding-plan-exercise-cards"
                      role="tabpanel"
                    >
                      {workoutListActivities(activeSession).map(
                        (activity, index) => {
                          const key = `${activeSession.day}-${activity.type}-${activity.name}-${index}`;
                          const query = activityYoutubeQuery(activity);
                          const searchUrl = query
                            ? youtubeSearchUrl(query)
                            : null;
                          const thumbnailUrl = query
                            ? thumbnails[query]
                            : null;
                          const clock = formatSecondsClock(
                            activityTotalSeconds(activity)
                          );
                          const addOn = isAddOnActivity(activity);

                          if (activity.type === "rest") {
                            return (
                              <article
                                className="onboarding-plan-exercise-card onboarding-plan-exercise-card--rest"
                                key={key}
                              >
                                <div className="onboarding-plan-exercise-main">
                                  <div
                                    className="onboarding-plan-exercise-thumb onboarding-plan-exercise-thumb--rest"
                                    aria-hidden
                                  >
                                    ⏱
                                  </div>
                                  <div className="onboarding-plan-exercise-copy">
                                    <strong>Rest</strong>
                                    <p>60s recovery</p>
                                    <p className="onboarding-plan-exercise-duration">
                                      {clock}
                                    </p>
                                  </div>
                                </div>
                                <div
                                  className="onboarding-plan-rest-ring"
                                  aria-label={`Rest ${clock}`}
                                >
                                  <span>{clock}</span>
                                </div>
                              </article>
                            );
                          }

                          return (
                            <article
                              className={`onboarding-plan-exercise-card onboarding-plan-exercise-card--no-check${
                                addOn ? " is-addon" : ""
                              }`}
                              key={key}
                            >
                              {searchUrl ? (
                                <a
                                  className="onboarding-plan-exercise-main"
                                  href={searchUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Search YouTube for ${activity.name}`}
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
                                    <strong>{activity.name}</strong>
                                    <p>
                                      {activity.sets
                                        ? `${activity.sets} sets`
                                        : null}
                                      {activity.sets && activity.reps
                                        ? " × "
                                        : null}
                                      {activity.reps}
                                    </p>
                                    <p className="onboarding-plan-exercise-duration">
                                      {clock}
                                    </p>
                                  </div>
                                </a>
                              ) : (
                                <div className="onboarding-plan-exercise-main">
                                  <div className="onboarding-plan-exercise-thumb">
                                    <span aria-hidden>▶</span>
                                  </div>
                                  <div className="onboarding-plan-exercise-copy">
                                    <strong>{activity.name}</strong>
                                    <p>
                                      {activity.sets
                                        ? `${activity.sets} sets`
                                        : null}
                                      {activity.sets && activity.reps
                                        ? " × "
                                        : null}
                                      {activity.reps}
                                    </p>
                                    <p className="onboarding-plan-exercise-duration">
                                      {clock}
                                    </p>
                                  </div>
                                </div>
                              )}
                              <div
                                className="onboarding-plan-rest-ring"
                                aria-label={`Duration ${clock}`}
                              >
                                <span>{clock}</span>
                              </div>
                            </article>
                          );
                        }
                      )}
                    </div>
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
