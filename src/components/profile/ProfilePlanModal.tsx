"use client";

import { useEffect, useId, useState } from "react";
import type { WorkoutPlan } from "@/lib/workout-plan";
import { youtubeSearchUrl } from "@/lib/youtube-exercise";

type PlanSection = "warmup" | "workouts";

export function ProfilePlanModal({
  plan,
  open,
  onClose
}: {
  plan: WorkoutPlan;
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
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
    setActiveDay(0);
    setOpenSection("workouts");
  }, [open, plan]);

  useEffect(() => {
    if (!open) return;

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

  const activeSession = plan.weeklySchedule[activeDay] ?? null;

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
          <span>{plan.experience}</span>
          <span>{plan.split}</span>
          <span>{plan.goal}</span>
          <span>{plan.sessionsPerWeek}x / week</span>
          <span>~{plan.sessionDurationMinutes} min</span>
        </div>

        <div className="profile-plan-modal-body">
          <section className="profile-plan-modal-block">
            <button
              type="button"
              className="profile-plan-modal-block-trigger"
              aria-expanded={openSection === "warmup"}
              onClick={() => toggleSection("warmup")}
            >
              <span>Warm-up · {plan.warmup.durationMinutes} min</span>
              <span aria-hidden>
                {openSection === "warmup" ? "▾" : "▸"}
              </span>
            </button>
            {openSection === "warmup" ? (
              <ol className="profile-plan-modal-steps">
                {plan.warmup.steps.map((step, index) => (
                  <li key={step}>
                    <em>{index + 1}</em>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
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
              <span>Workouts · {plan.weeklySchedule.length} sessions</span>
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
                    className="profile-plan-modal-exercise-cards"
                    role="tabpanel"
                  >
                    {activeSession.exercises.map((exercise) => {
                      const searchUrl = youtubeSearchUrl(exercise.exercise);
                      const thumbnailUrl = thumbnails[exercise.exercise];
                      const restLabel = `${Math.floor(
                        exercise.restSeconds / 60
                      )
                        .toString()
                        .padStart(2, "0")}:${(exercise.restSeconds % 60)
                        .toString()
                        .padStart(2, "0")}`;
                      return (
                        <article
                          className="profile-plan-modal-exercise-card"
                          key={`${activeSession.day}-${exercise.exercise}`}
                        >
                          <a
                            className="profile-plan-modal-exercise-main"
                            href={searchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Search YouTube for ${exercise.exercise}`}
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
                              <strong>{exercise.exercise}</strong>
                              <p>
                                {exercise.sets} sets × {exercise.reps}
                              </p>
                              <p>Rest {exercise.restSeconds}s</p>
                            </div>
                          </a>
                          <div
                            className="profile-plan-modal-rest-ring"
                            aria-label={`Rest ${restLabel}`}
                          >
                            <span>{restLabel}</span>
                          </div>
                        </article>
                      );
                    })}
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
