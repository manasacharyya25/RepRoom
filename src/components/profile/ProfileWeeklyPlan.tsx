"use client";

import { useEffect, useMemo, useState } from "react";
import { ProfilePlanModal } from "@/components/profile/ProfilePlanModal";
import { createClient } from "@/lib/supabase/client";
import type { WorkoutPlan } from "@/lib/workout-plan";
import { normalizeWorkoutPlan } from "@/lib/workout-plan";
import { humanizePlanLabel } from "@/lib/workout-plan-seed";
import { listWorkoutDayCompletions } from "@/lib/workout-log-api";
import {
  addDays,
  buildWeekDaySlots,
  dateKey,
  formatDurationHours,
  formatWeekRange,
  startOfWeekMonday,
  statusLabel,
  weekPlanStats,
  weekRelativeLabel,
  type WeekDaySlot
} from "@/lib/weekly-plan-calendar";

type PlanGenerateFields = {
  primaryFitnessGoal: string | null;
  fitnessExperience: string | null;
  workoutDaysPerWeek: number | null;
  sessionMinutes: number | null;
};

function DayIcon({ slot }: { slot: WeekDaySlot }) {
  if (slot.isRest) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4.5 12.5h15M6.5 12.5V9.8c0-1.2.8-2.3 2-2.6l2.4-.7c1.4-.4 2.8.5 3.1 1.9l.3 1.1c.2.8.9 1.4 1.7 1.4H17"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 15.5h10"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const label = (slot.label ?? "").toLowerCase();
  if (label.includes("cardio")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3.5 12h3.2l1.6-3.2 2.4 6.4 1.8-3.6H20.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (label.includes("pull") || label.includes("back")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 7.5h8M9.5 7.5v9M14.5 7.5v9M7 16.5h10"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.2 9.2h2.1v5.6H7.2a1.7 1.7 0 0 1 0-3.4Zm7.5 0h2.1a1.7 1.7 0 1 1 0 3.4h-2.1V9.2ZM9.3 12h5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusIcon({ status }: { status: WeekDaySlot["status"] }) {
  if (status === "completed") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="m4.2 8.2 2.4 2.4 5.2-5.4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "missed") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M8 4.2v5.2M8 11.6h.01"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return null;
}

export function ProfileWeeklyPlan({
  plan,
  planStatus,
  dayStreak = 0,
  readOnly = false,
  planFields = null,
  onPlanCreated
}: {
  plan: WorkoutPlan | null;
  planStatus: string | null;
  dayStreak?: number;
  readOnly?: boolean;
  planFields?: PlanGenerateFields | null;
  onPlanCreated?: (plan: WorkoutPlan) => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [completedDateKeys, setCompletedDateKeys] = useState<Set<string>>(
    () => new Set()
  );

  const normalizedPlan = useMemo(
    () => (plan ? normalizeWorkoutPlan(plan) ?? plan : null),
    [plan]
  );

  const weekStart = useMemo(() => {
    const base = startOfWeekMonday(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  useEffect(() => {
    if (readOnly || !normalizedPlan) {
      setCompletedDateKeys(new Set());
      return;
    }
    let cancelled = false;
    const from = dateKey(addDays(weekStart, -7));
    const to = dateKey(addDays(weekStart, 13));
    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const rows = await listWorkoutDayCompletions(supabase, user.id, {
          from,
          to
        });
        if (cancelled) return;
        setCompletedDateKeys(new Set(rows.map((row) => row.loggedOn)));
      } catch {
        if (!cancelled) setCompletedDateKeys(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalizedPlan, readOnly, weekStart]);

  const slots = useMemo(
    () =>
      normalizedPlan
        ? buildWeekDaySlots(
            normalizedPlan,
            weekStart,
            new Date(),
            completedDateKeys
          )
        : [],
    [normalizedPlan, weekStart, completedDateKeys]
  );

  const stats = useMemo(() => weekPlanStats(slots), [slots]);
  const title = weekRelativeLabel(weekStart);
  const range = formatWeekRange(weekStart);

  const openPlanAtDay = (dayIndex = 0) => {
    setSelectedDayIndex(dayIndex);
    setPlanOpen(true);
  };

  const createWorkoutPlan = async () => {
    if (readOnly || generating) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const response = await fetch("/api/workout-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryGoal: planFields?.primaryFitnessGoal || "build_muscle",
          fitnessExperience: planFields?.fitnessExperience || "just_starting",
          daysPerWeek: planFields?.workoutDaysPerWeek ?? 3,
          sessionMinutes: planFields?.sessionMinutes ?? 60
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

      const nextPlan =
        normalizeWorkoutPlan(payload.plan) ?? (payload.plan as WorkoutPlan);
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to save your workout plan.");

      const { error } = await supabase
        .from("profiles")
        .update({
          workout_plan: nextPlan,
          workout_plan_status: "needs_plan",
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);
      if (error) throw error;

      onPlanCreated?.(nextPlan);
    } catch (caught) {
      setGenerateError(
        caught instanceof Error
          ? caught.message
          : "Could not generate your workout plan."
      );
    } finally {
      setGenerating(false);
    }
  };

  if (!normalizedPlan) {
    const ctaLabel =
      planStatus === "has_own"
        ? "Generate a RhoQ schedule"
        : "Create workout plan";

    return (
      <div className="profile-week-plan">
        <div className="profile-week-plan-head">
          <div className="profile-week-plan-titles">
            <h2>Weekly plan</h2>
          </div>
        </div>
        {readOnly ? (
          <p className="profile-goals-empty">No workout plan shared.</p>
        ) : (
          <div className="profile-week-plan-empty">
            <p className="profile-goals-empty">
              {planStatus === "has_own"
                ? "You’re following your own plan. Generate a RhoQ schedule to track it here."
                : "No workout plan yet. Create one from your fitness goals."}
            </p>
            <button
              type="button"
              className="btn-primary profile-week-plan-create"
              disabled={generating}
              onClick={() => void createWorkoutPlan()}
            >
              {generating ? "Generating…" : ctaLabel}
            </button>
            {generateError ? (
              <p className="profile-week-plan-create-error" role="alert">
                {generateError}
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="profile-week-plan">
      <div className="profile-week-plan-head">
        <div className="profile-week-plan-titles">
          <h2>{title}</h2>
          <p className="profile-week-plan-range">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect
                x="2.25"
                y="3.25"
                width="11.5"
                height="10.5"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M5 2.25v2M11 2.25v2M2.25 6.5h11.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            {range}
          </p>
          <p className="profile-week-plan-meta">
            {[
              humanizePlanLabel(normalizedPlan.experience),
              humanizePlanLabel(normalizedPlan.split),
              humanizePlanLabel(normalizedPlan.goal)
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="profile-week-plan-nav">
          <button
            type="button"
            className="profile-week-plan-nav-btn"
            aria-label="Previous week"
            onClick={() => setWeekOffset((value) => value - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="profile-week-plan-today"
            onClick={() => setWeekOffset(0)}
          >
            Today
          </button>
          <button
            type="button"
            className="profile-week-plan-nav-btn"
            aria-label="Next week"
            onClick={() => setWeekOffset((value) => value + 1)}
          >
            ›
          </button>
        </div>
      </div>

      <div className="profile-week-plan-stats">
        <article className="profile-week-stat is-completed">
          <span className="profile-week-stat-icon" aria-hidden>
            <svg viewBox="0 0 20 20" fill="none">
              <circle
                cx="10"
                cy="10"
                r="7.25"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="m6.8 10.1 2.1 2.1 4.3-4.4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <strong>
              {stats.completed} / {stats.total}
            </strong>
            <span>Completed</span>
          </div>
        </article>
        <article className="profile-week-stat is-streak">
          <span className="profile-week-stat-icon" aria-hidden>
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M10.4 3.2c.4 2.1-.2 3.4-1.5 4.6-1.1 1-1.7 2-1.5 3.4.3 2 2 3.4 4.1 3.4 2.4 0 4.2-1.9 4.2-4.3 0-2.8-1.7-4.5-3.5-6.1-.4 1.2-1.1 2-1.8-.1Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <strong>{dayStreak} Day</strong>
            <span>Streak</span>
          </div>
        </article>
        <article className="profile-week-stat is-time">
          <span className="profile-week-stat-icon" aria-hidden>
            <svg viewBox="0 0 20 20" fill="none">
              <circle
                cx="10"
                cy="10"
                r="7.25"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M10 6.5V10l2.4 1.6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <strong>{formatDurationHours(stats.plannedMinutes)}</strong>
            <span>Total Time</span>
          </div>
        </article>
      </div>

      <ol className="profile-week-plan-list">
        {slots.map((slot) => {
          const canOpenWorkout = slot.sessionIndex != null;
          return (
            <li key={slot.dateKey}>
              <button
                type="button"
                className={[
                  "profile-week-day",
                  `is-${slot.status}`,
                  slot.isToday ? "is-today" : "",
                  canOpenWorkout ? "is-clickable" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!canOpenWorkout}
                aria-label={
                  canOpenWorkout
                    ? `View workout: ${slot.label ?? slot.sessionTitle}`
                    : `${slot.weekday} rest day`
                }
                onClick={() => {
                  if (slot.sessionIndex == null) return;
                  openPlanAtDay(slot.sessionIndex);
                }}
              >
                <div className="profile-week-day-date">
                  <span className="profile-week-day-dow">{slot.weekday}</span>
                  <span className="profile-week-day-num">{slot.dateLabel}</span>
                </div>

                <span className={`profile-week-day-icon is-${slot.status}`}>
                  <DayIcon slot={slot} />
                </span>

                <div className="profile-week-day-main">
                  <strong>
                    {slot.isRest ? "Rest" : slot.label}
                    {slot.isToday ? (
                      <span className="profile-week-day-today-tag">Today</span>
                    ) : null}
                  </strong>
                  {slot.isRest ? (
                    <span className="profile-week-day-meta">Recovery day</span>
                  ) : (
                    <span className="profile-week-day-meta">
                      {slot.sessionTitle &&
                      slot.sessionTitle !== slot.label ? (
                        <>
                          <span>{slot.sessionTitle}</span>
                          <span aria-hidden>·</span>
                        </>
                      ) : null}
                      <span>{slot.durationMinutes} min</span>
                      <span aria-hidden>·</span>
                      <span>{slot.exerciseCount} exercises</span>
                    </span>
                  )}
                </div>

                <span className={`profile-week-day-badge is-${slot.status}`}>
                  <StatusIcon status={slot.status} />
                  {statusLabel(slot.status)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <footer className="profile-week-plan-foot">
        <p className="profile-week-plan-tip">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M8 2.4a3.8 3.8 0 0 0-2.2 6.9c.4.3.7.8.7 1.3v.4h3v-.4c0-.5.3-1 .7-1.3A3.8 3.8 0 0 0 8 2.4Z"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M6.6 12.4h2.8M7 13.6h2"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          Consistency builds results. You’ve got this!
        </p>
        <button
          type="button"
          className="profile-week-plan-cta"
          onClick={() => openPlanAtDay(0)}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M4.25 2.75h5.2L11.75 5.1v8.15H4.25V2.75Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path
              d="M9.2 2.75V5.2h2.55M6 8h4M6 10.25h4"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          View Full Plan
        </button>
      </footer>

      <ProfilePlanModal
        plan={normalizedPlan}
        open={planOpen}
        initialDayIndex={selectedDayIndex}
        onClose={() => setPlanOpen(false)}
      />
    </div>
  );
}
