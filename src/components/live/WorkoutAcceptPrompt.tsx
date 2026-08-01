"use client";

import Link from "next/link";
import {
  exerciseCount,
  normalizeWorkoutPlan,
  sessionDurationMinutes,
  type WorkoutPlan
} from "@/lib/workout-plan";
import {
  buildWeekDaySlots,
  startOfWeekMonday,
  type WeekDaySlot
} from "@/lib/weekly-plan-calendar";

export type WorkoutAcceptDecision = "accept" | "skip";

function todaySlot(plan: WorkoutPlan): WeekDaySlot | null {
  const slots = buildWeekDaySlots(plan, startOfWeekMonday(new Date()));
  return slots.find((slot) => slot.isToday) ?? null;
}

export function WorkoutAcceptPrompt({
  plan,
  open,
  onClose,
  onDecision
}: {
  plan: WorkoutPlan | null;
  open: boolean;
  onClose: () => void;
  onDecision: (
    decision: WorkoutAcceptDecision,
    sessionIndex: number | null
  ) => void;
}) {
  if (!open) return null;

  const normalized = plan ? normalizeWorkoutPlan(plan) ?? plan : null;
  const today = normalized ? todaySlot(normalized) : null;
  const hasSession = Boolean(today && today.sessionIndex != null);
  const session =
    hasSession && today?.sessionIndex != null
      ? normalized?.days[today.sessionIndex] ?? null
      : null;

  return (
    <div
      className="live-workout-accept-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="live-workout-accept-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-workout-accept-title"
        onClick={(event) => event.stopPropagation()}
      >
        {!normalized ? (
          <>
            <h2 id="live-workout-accept-title">No workout plan yet</h2>
            <p>
              Create a workout plan to get guided sessions when you go live. You
              can skip and broadcast anyway.
            </p>
            <div className="live-workout-accept-actions">
              <Link
                className="live-workout-accept-secondary"
                href="/onboarding?step=plan"
              >
                Create plan
              </Link>
              <button
                type="button"
                className="live-workout-accept-primary"
                onClick={() => onDecision("skip", null)}
              >
                Skip & Go Live
              </button>
            </div>
          </>
        ) : hasSession && session && today ? (
          <>
            <h2 id="live-workout-accept-title">Today&apos;s workout</h2>
            <p className="live-workout-accept-session">
              {today.sessionTitle ?? session.title}
            </p>
            <p className="live-workout-accept-meta">
              {sessionDurationMinutes(normalized)} min ·{" "}
              {exerciseCount(session)} exercises
            </p>
            <ul className="live-workout-accept-exercises">
              {session.activities
                .filter((item) => item.type === "exercise")
                .slice(0, 5)
                .map((item) => (
                  <li key={item.name}>{item.name}</li>
                ))}
            </ul>
            <div className="live-workout-accept-actions">
              <button
                type="button"
                className="live-workout-accept-secondary"
                onClick={() => onDecision("skip", today.sessionIndex)}
              >
                Skip & Go Live
              </button>
              <button
                type="button"
                className="live-workout-accept-primary"
                onClick={() => onDecision("accept", today.sessionIndex)}
              >
                Accept & Go Live
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="live-workout-accept-title">Rest day</h2>
            <p>
              No session is scheduled for today on your plan. You can still go
              live.
            </p>
            <div className="live-workout-accept-actions">
              <button
                type="button"
                className="live-workout-accept-primary"
                onClick={() => onDecision("skip", null)}
              >
                Skip & Go Live
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
