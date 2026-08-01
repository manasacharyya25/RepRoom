"use client";

import { useMemo, useState } from "react";
import { ProfilePlanModal } from "@/components/profile/ProfilePlanModal";
import type { WorkoutPlan } from "@/lib/workout-plan";
import {
  addDays,
  buildWeekDaySlots,
  formatDurationHours,
  formatWeekRange,
  startOfWeekMonday,
  statusLabel,
  weekPlanStats,
  weekRelativeLabel,
  type WeekDaySlot
} from "@/lib/weekly-plan-calendar";

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
  readOnly = false
}: {
  plan: WorkoutPlan | null;
  planStatus: string | null;
  dayStreak?: number;
  readOnly?: boolean;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [planOpen, setPlanOpen] = useState(false);

  const weekStart = useMemo(() => {
    const base = startOfWeekMonday(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const slots = useMemo(
    () => (plan ? buildWeekDaySlots(plan, weekStart) : []),
    [plan, weekStart]
  );

  const stats = useMemo(() => weekPlanStats(slots), [slots]);
  const title = weekRelativeLabel(weekStart);
  const range = formatWeekRange(weekStart);

  if (!plan) {
    return (
      <div className="profile-week-plan">
        <div className="profile-week-plan-head">
          <div className="profile-week-plan-titles">
            <h2>Weekly plan</h2>
          </div>
        </div>
        <p className="profile-goals-empty">
          {readOnly
            ? "No workout plan shared."
            : planStatus === "has_own"
              ? "You’re following your own plan. A RhoQ schedule will show here if you generate one later."
              : "No workout plan yet. Finish onboarding to generate one."}
        </p>
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
            {[plan.experience, plan.split, plan.goal]
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
        {slots.map((slot) => (
          <li
            key={slot.dateKey}
            className={[
              "profile-week-day",
              `is-${slot.status}`,
              slot.isToday ? "is-today" : ""
            ]
              .filter(Boolean)
              .join(" ")}
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
          </li>
        ))}
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
          onClick={() => setPlanOpen(true)}
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
        plan={plan}
        open={planOpen}
        onClose={() => setPlanOpen(false)}
      />
    </div>
  );
}
