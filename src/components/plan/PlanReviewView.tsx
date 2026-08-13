"use client";

import { useEffect, useState, type ReactNode } from "react";
import { youtubeSearchUrl } from "@/lib/youtube-exercise";
import {
  activityTotalSeconds,
  activityYoutubeQuery,
  dayTotalSeconds,
  exerciseCount,
  formatSecondsClock,
  isAddOnActivity,
  sessionDurationMinutes,
  warmupActivities,
  warmupDurationSeconds,
  workoutListActivities,
  workoutTabLabel,
  type WorkoutActivity,
  type WorkoutPlan
} from "@/lib/workout-plan";
import { humanizePlanLabel } from "@/lib/workout-plan-seed";

const OVERVIEW_ICONS = {
  goal: "🏔",
  style: "🏋",
  frequency: "📅",
  experience: "📈",
  split: "🔀",
  session: "⏱"
} as const;

function shortPlanDescription(text: string, maxChars = 160): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const sentences =
    trimmed.match(/[^.!?]+[.!?]*/g)?.map((part) => part.trim()).filter(Boolean) ??
    [trimmed];
  let out = sentences[0] ?? "";
  if (sentences[1] && `${out} ${sentences[1]}`.length <= maxChars) {
    out = `${out} ${sentences[1]}`;
  }
  if (out.length > maxChars) {
    return `${out.slice(0, maxChars - 1).trimEnd()}…`;
  }
  return out;
}

function PlanExerciseCard({
  item,
  kind,
  thumbnails
}: {
  item: WorkoutActivity;
  kind: "warmup" | "workout";
  thumbnails: Record<string, string | null>;
}) {
  const query = activityYoutubeQuery(item);
  const searchUrl = query ? youtubeSearchUrl(query) : null;
  const thumbnailUrl = query ? thumbnails[query] : null;
  const clock = formatSecondsClock(activityTotalSeconds(item));
  const addOn = kind === "workout" && isAddOnActivity(item);
  const isRest = item.type === "rest";
  const showSets = kind === "workout" && !isRest && (item.sets || item.reps);

  const body = (
    <>
      <div
        className={`onboarding-plan-exercise-thumb${
          isRest ? " onboarding-plan-exercise-thumb--rest" : ""
        }`}
      >
        {searchUrl ? (
          thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" loading="lazy" />
          ) : (
            <span aria-hidden>▶</span>
          )
        ) : isRest ? (
          <span aria-hidden>❚❚</span>
        ) : null}
      </div>
      <div className="onboarding-plan-exercise-copy">
        <strong>{item.name}</strong>
        {showSets ? (
          <p>
            {item.sets ? `${item.sets} sets` : null}
            {item.sets && item.reps ? " × " : null}
            {item.reps}
          </p>
        ) : null}
        <p className="onboarding-plan-exercise-duration">{clock}</p>
      </div>
    </>
  );

  return (
    <article
      className={`onboarding-plan-exercise-card onboarding-plan-exercise-card--no-check${
        addOn ? " is-addon" : ""
      }${isRest ? " onboarding-plan-exercise-card--rest" : ""}`}
    >
      {searchUrl && !isRest ? (
        <a
          className="onboarding-plan-exercise-main"
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {body}
        </a>
      ) : (
        <div className="onboarding-plan-exercise-main">{body}</div>
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

export function PlanReviewView({
  plan,
  focus = "",
  equipment = "",
  style = "",
  toolbar,
  footer,
  error,
  status
}: {
  plan: WorkoutPlan;
  focus?: string;
  equipment?: string;
  style?: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
  error?: string | null;
  status?: ReactNode;
}) {
  const [activeDay, setActiveDay] = useState(0);
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>(
    {}
  );

  useEffect(() => {
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

  useEffect(() => {
    setActiveDay(0);
  }, [plan]);

  const activeSession = plan.days[activeDay] ?? null;
  const activeWarmups = activeSession ? warmupActivities(activeSession) : [];
  const activeWorkouts = activeSession
    ? workoutListActivities(activeSession)
    : [];
  const planSummary = [
    humanizePlanLabel(plan.goal) || humanizePlanLabel(focus),
    humanizePlanLabel(style) || humanizePlanLabel(plan.workoutStyle),
    `${plan.sessionsPerWeek}×/week`,
    `~${sessionDurationMinutes(plan)} min`
  ]
    .filter(Boolean)
    .join(" · ");
  const planBlurb = shortPlanDescription(plan.description);
  const showAboutPlan = Boolean(
    plan.description.trim() && plan.description.trim() !== planBlurb
  );
  const todayExerciseCount = activeSession ? exerciseCount(activeSession) : 0;
  const todayMinutes = activeSession
    ? Math.max(1, Math.round(dayTotalSeconds(activeSession) / 60))
    : 0;

  return (
    <section className="plan-review" aria-labelledby="plan-review-title">
      {toolbar}
      <p className="plan-kicker">Your plan</p>
      <h1 id="plan-review-title">{plan.name}</h1>
      {planSummary ? <p className="plan-review-meta">{planSummary}</p> : null}
      {planBlurb ? (
        <p className="plan-lede plan-lede--short">{planBlurb}</p>
      ) : null}

      {showAboutPlan ? (
        <details className="plan-disclosure">
          <summary>About this plan</summary>
          <p>{plan.description}</p>
        </details>
      ) : null}

      <details className="plan-disclosure">
        <summary>Plan details</summary>
        <div className="onboarding-plan-overview-grid plan-review-overview">
          <article>
            <span aria-hidden>{OVERVIEW_ICONS.goal}</span>
            <div>
              <small>Goal</small>
              <strong>{humanizePlanLabel(plan.goal)}</strong>
            </div>
          </article>
          <article>
            <span aria-hidden>{OVERVIEW_ICONS.split}</span>
            <div>
              <small>Focus</small>
              <strong>
                {humanizePlanLabel(focus) || humanizePlanLabel(plan.split)}
              </strong>
            </div>
          </article>
          <article>
            <span aria-hidden>{OVERVIEW_ICONS.style}</span>
            <div>
              <small>Style</small>
              <strong>
                {humanizePlanLabel(style) ||
                  humanizePlanLabel(plan.workoutStyle)}
              </strong>
            </div>
          </article>
          <article>
            <span aria-hidden>🛠</span>
            <div>
              <small>Equipment</small>
              <strong>{humanizePlanLabel(equipment) || "—"}</strong>
            </div>
          </article>
          <article>
            <span aria-hidden>{OVERVIEW_ICONS.frequency}</span>
            <div>
              <small>Frequency</small>
              <strong>{plan.sessionsPerWeek}× / week</strong>
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
      </details>

      <div
        className="plan-day-switch"
        role="tablist"
        aria-label="Workout days"
      >
        {plan.days.map((day, index) => (
          <button
            key={`${day.day}-${index}`}
            type="button"
            role="tab"
            aria-selected={activeDay === index}
            className={activeDay === index ? "is-active" : undefined}
            onClick={() => setActiveDay(index)}
          >
            {workoutTabLabel(day, index)}
          </button>
        ))}
      </div>

      <section className="plan-today" aria-labelledby="plan-today-title">
        <h2 id="plan-today-title">
          Today&apos;s workout
          {activeSession
            ? ` · ${todayExerciseCount} exercise${
                todayExerciseCount === 1 ? "" : "s"
              } · ~${todayMinutes} min`
            : ""}
        </h2>

        {activeWarmups.length ? (
          <details className="plan-disclosure plan-disclosure--nested">
            <summary>
              Warm-up
              {activeSession
                ? ` · ${Math.max(
                    1,
                    Math.round(warmupDurationSeconds(activeSession) / 60)
                  )} min`
                : ""}
            </summary>
            <div className="onboarding-plan-exercise-cards plan-exercise-list">
              {activeWarmups.map((item, index) => (
                <PlanExerciseCard
                  key={`${item.name}-wu-${index}`}
                  item={item}
                  kind="warmup"
                  thumbnails={thumbnails}
                />
              ))}
            </div>
          </details>
        ) : null}

        <div className="onboarding-plan-exercise-cards plan-exercise-list">
          {activeWorkouts.map((item, index) => (
            <PlanExerciseCard
              key={`${item.name}-wo-${index}`}
              item={item}
              kind="workout"
              thumbnails={thumbnails}
            />
          ))}
        </div>
      </section>

      {error ? (
        <p className="plan-error" role="alert">
          {error}
        </p>
      ) : null}
      {status}
      {footer}
    </section>
  );
}
