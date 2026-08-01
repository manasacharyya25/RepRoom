"use client";

import { useMemo, useState } from "react";
import type { LobbyMessageView } from "@/lib/types/lobby-chat";
import type { WorkoutPlan } from "@/lib/workout-plan";
import { dateKey } from "@/lib/weekly-plan-calendar";

function parseDurationToSeconds(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+:\d{1,2}$/.test(trimmed)) {
    const [m, s] = trimmed.split(":").map(Number);
    if (!Number.isFinite(m) || !Number.isFinite(s) || s >= 60) return null;
    const total = m * 60 + s;
    return total > 0 ? total : null;
  }
  const asNumber = Number(trimmed);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return null;
  if (trimmed.includes(".")) return Math.round(asNumber * 60);
  if (asNumber <= 180) return Math.round(asNumber * 60);
  return Math.round(asNumber);
}

export function LobbyChatComposer({
  onSendWorkoutLog,
  disabled,
  exerciseOptions = [],
  planDayIndex = null,
  inputId = "lobby-chat-input",
  classPrefix = "live-rooms-messages"
}: {
  onSendWorkoutLog: (message: LobbyMessageView) => void;
  disabled: boolean;
  exerciseOptions?: string[];
  planDayIndex?: number | null;
  inputId?: string;
  classPrefix?: string;
}) {
  const [exerciseName, setExerciseName] = useState("");
  const [setNumber, setSetNumber] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [duration, setDuration] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [logSending, setLogSending] = useState(false);

  const uniqueExercises = useMemo(
    () =>
      [...new Set(exerciseOptions.map((name) => name.trim()).filter(Boolean))],
    [exerciseOptions]
  );

  const hasDetail =
    Boolean(setNumber.trim()) ||
    Boolean(reps.trim()) ||
    Boolean(weight.trim()) ||
    Boolean(duration.trim());
  const canSubmitLog =
    Boolean(exerciseName.trim()) && hasDetail && !logSending && !disabled;

  const submitLog = async () => {
    if (!canSubmitLog) return;

    let durationSeconds: number | null = null;
    if (duration.trim()) {
      durationSeconds = parseDurationToSeconds(duration);
      if (durationSeconds == null) {
        setFormError("Use time like 1:30 or minutes (e.g. 2).");
        return;
      }
    }

    const setValue = setNumber.trim() ? Number(setNumber) : null;
    if (setNumber.trim() && (!Number.isFinite(setValue) || (setValue ?? 0) < 1)) {
      setFormError("Set must be a positive number.");
      return;
    }

    setFormError(null);
    setLogSending(true);
    try {
      const response = await fetch("/api/workout-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseName: exerciseName.trim(),
          set: setValue,
          reps: reps.trim() || null,
          weight: weight.trim() || null,
          durationSeconds,
          planDayIndex,
          loggedOn: dateKey(new Date())
        })
      });
      const data = (await response.json().catch(() => null)) as {
        message?: LobbyMessageView;
        error?: string;
      } | null;
      if (!response.ok || !data?.message) {
        throw new Error(data?.error || "Could not log workout.");
      }
      onSendWorkoutLog(data.message);
      if (setValue != null) setSetNumber(String(setValue + 1));
      setReps("");
      setWeight("");
      setDuration("");
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : "Could not log workout."
      );
    } finally {
      setLogSending(false);
    }
  };

  return (
    <div className={`${classPrefix}-composer-wrap`}>
      <form
        className={`${classPrefix}-log-form`}
        onSubmit={(event) => {
          event.preventDefault();
          void submitLog();
        }}
      >
        <label className={`${classPrefix}-log-field`}>
          <span>Exercise</span>
          <input
            id={inputId}
            list={`${inputId}-exercises`}
            value={exerciseName}
            onChange={(event) => setExerciseName(event.target.value)}
            placeholder="e.g. Bench Press"
            disabled={logSending || disabled}
            required
          />
          {uniqueExercises.length > 0 ? (
            <datalist id={`${inputId}-exercises`}>
              {uniqueExercises.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : null}
        </label>
        <div className={`${classPrefix}-log-grid`}>
          <label className={`${classPrefix}-log-field`}>
            <span>Set</span>
            <input
              type="number"
              min={1}
              max={100}
              value={setNumber}
              onChange={(event) => setSetNumber(event.target.value)}
              placeholder="optional"
              disabled={logSending || disabled}
            />
          </label>
          <label className={`${classPrefix}-log-field`}>
            <span>Reps</span>
            <input
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              placeholder="optional"
              disabled={logSending || disabled}
            />
          </label>
          <label className={`${classPrefix}-log-field`}>
            <span>Weight</span>
            <input
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="optional"
              disabled={logSending || disabled}
            />
          </label>
          <label className={`${classPrefix}-log-field`}>
            <span>Time</span>
            <input
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              placeholder="optional"
              disabled={logSending || disabled}
            />
          </label>
        </div>
        {formError ? (
          <p className={`${classPrefix}-error`}>{formError}</p>
        ) : null}
        <button
          className={`${classPrefix}-send`}
          type="submit"
          disabled={!canSubmitLog}
        >
          {logSending ? "…" : "Log set"}
        </button>
      </form>
    </div>
  );
}

export function exerciseNamesFromPlan(
  plan: WorkoutPlan | null,
  sessionIndex: number | null
): string[] {
  if (!plan || sessionIndex == null) return [];
  const day = plan.days[sessionIndex];
  if (!day) return [];
  return day.activities
    .filter((item) => item.type === "exercise")
    .map((item) => item.name);
}
