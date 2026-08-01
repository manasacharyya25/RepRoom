"use client";

import { useEffect, useId, useMemo, useState } from "react";
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

type PlanSection = "warmup" | "workouts";

export function ProfilePlanModal({
  plan: rawPlan,
  open,
  onClose,
  initialDayIndex = 0
}: {
  plan: WorkoutPlan;
  open: boolean;
  onClose: () => void;
  /** Plan day index to select when the modal opens. */
  initialDayIndex?: number;
}) {
  const titleId = useId();
  const plan = useMemo(() => {
    const normalized = normalizeWorkoutPlan(rawPlan) ?? rawPlan;
    return scalePlanToSessionDuration(normalized);
  }, [rawPlan]);
  const [activeDay, setActiveDay] = useState(0);
  const [openSection, setOpenSection] = useState<PlanSection | null>("workouts");
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>(
    {}
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const clamped = Math.min(
      Math.max(0, initialDayIndex),
      Math.max(0, plan.days.length - 1)
    );
    setActiveDay(clamped);
    setOpenSection("workouts");
  }, [open, plan, initialDayIndex]);

  useEffect(() => {
    if (!open) return;

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
  }, [open, plan]);

  const toggleSection = (section: PlanSection) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  const activeSession = plan.days[activeDay] ?? null;
  const activeWarmups = activeSession ? warmupActivities(activeSession) : [];

  if (!open) return null;

  return (
    <div
      className="profile-plan-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="profile-plan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="profile-plan-modal-head">
          <div>
            <p className="profile-plan-modal-kicker">Full plan</p>
            <h2 id={titleId}>{plan.name}</h2>
            <p>{plan.description}</p>
          </div>
          <button
            type="button"
            className="profile-plan-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="profile-plan-modal-meta">
          <span>{humanizePlanLabel(plan.experience)}</span>
          <span>{humanizePlanLabel(plan.split)}</span>
          <span>{humanizePlanLabel(plan.goal)}</span>
          <span>{plan.sessionsPerWeek}x / week</span>
          <span>~{sessionDurationMinutes(plan)} min</span>
        </div>

        <div className="profile-plan-modal-body">
          <section className="profile-plan-modal-block">
            <button
              type="button"
              className="profile-plan-modal-block-trigger"
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
              <div className="profile-plan-modal-exercise-cards profile-plan-modal-exercise-cards--inline">
                {activeWarmups.map((item, index) => {
                  const query = activityYoutubeQuery(item);
                  const searchUrl = query ? youtubeSearchUrl(query) : null;
                  const thumbnailUrl = query ? thumbnails[query] : null;
                  const clock = formatSecondsClock(activityTotalSeconds(item));
                  return (
                    <article
                      className="profile-plan-modal-exercise-card"
                      key={`${item.name}-${index}`}
                    >
                      {searchUrl ? (
                        <a
                          className="profile-plan-modal-exercise-main"
                          href={searchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Search YouTube for ${item.name}`}
                        >
                          <div className="profile-plan-modal-exercise-thumb">
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
                          <div className="profile-plan-modal-exercise-copy">
                            <strong>{item.name}</strong>
                            <p>
                              {item.sets ? `${item.sets} sets` : null}
                              {item.sets && item.reps ? " × " : null}
                              {item.reps}
                            </p>
                            <p className="profile-plan-modal-exercise-duration">
                              {clock}
                            </p>
                          </div>
                        </a>
                      ) : (
                        <div className="profile-plan-modal-exercise-main">
                          <div className="profile-plan-modal-exercise-thumb">
                            <span aria-hidden>▶</span>
                          </div>
                          <div className="profile-plan-modal-exercise-copy">
                            <strong>{item.name}</strong>
                            {item.reps ? <p>{item.reps}</p> : null}
                            <p className="profile-plan-modal-exercise-duration">
                              {clock}
                            </p>
                          </div>
                        </div>
                      )}
                      <div
                        className="profile-plan-modal-rest-ring"
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

          <section
            className={`profile-plan-modal-block profile-plan-modal-workouts${
              openSection === "workouts" ? " is-expanded-workouts" : ""
            }`}
          >
            <button
              type="button"
              className="profile-plan-modal-block-trigger"
              aria-expanded={openSection === "workouts"}
              onClick={() => toggleSection("workouts")}
            >
              <span>Workouts · {plan.days.length} sessions</span>
              <span aria-hidden>
                {openSection === "workouts" ? "▾" : "▸"}
              </span>
            </button>

            {openSection === "workouts" ? (
              <div className="profile-plan-modal-workouts-body">
                <div
                  className="profile-plan-modal-tabs"
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
                    className="profile-plan-modal-exercise-cards"
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
                              className="profile-plan-modal-exercise-card is-rest"
                              key={key}
                            >
                              <div className="profile-plan-modal-exercise-main">
                                <div
                                  className="profile-plan-modal-exercise-thumb is-rest"
                                  aria-hidden
                                >
                                  ⏱
                                </div>
                                <div className="profile-plan-modal-exercise-copy">
                                  <strong>Rest</strong>
                                  <p>60s recovery</p>
                                  <p className="profile-plan-modal-exercise-duration">
                                    {clock}
                                  </p>
                                </div>
                              </div>
                              <div
                                className="profile-plan-modal-rest-ring"
                                aria-label={`Rest ${clock}`}
                              >
                                <span>{clock}</span>
                              </div>
                            </article>
                          );
                        }

                        return (
                          <article
                            className={`profile-plan-modal-exercise-card${
                              addOn ? " is-addon" : ""
                            }`}
                            key={key}
                          >
                            {searchUrl ? (
                              <a
                                className="profile-plan-modal-exercise-main"
                                href={searchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Search YouTube for ${activity.name}`}
                              >
                                <div className="profile-plan-modal-exercise-thumb">
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
                                <div className="profile-plan-modal-exercise-copy">
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
                                  <p className="profile-plan-modal-exercise-duration">
                                    {clock}
                                  </p>
                                </div>
                              </a>
                            ) : (
                              <div className="profile-plan-modal-exercise-main">
                                <div className="profile-plan-modal-exercise-thumb">
                                  <span aria-hidden>▶</span>
                                </div>
                                <div className="profile-plan-modal-exercise-copy">
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
                                  <p className="profile-plan-modal-exercise-duration">
                                    {clock}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div
                              className="profile-plan-modal-rest-ring"
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
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
