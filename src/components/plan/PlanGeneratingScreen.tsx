"use client";

import { useEffect, useState } from "react";

export const REVEAL_HOLD_MS = 2800;

const GENERATE_STEPS = [
  "Understanding your goal",
  "Matching your experience",
  "Building your weekly split",
  "Selecting exercises",
  "Balancing your sessions"
] as const;

const FEATURE_CARDS = [
  {
    emoji: "👥",
    title: "Stay accountable",
    body: "Work out alongside others and make showing up easier."
  },
  {
    emoji: "📈",
    title: "Track your progress",
    body: "Log every workout and see how you're getting stronger."
  },
  {
    emoji: "🔥",
    title: "Find your people",
    body: "Share your progress, wins, and motivation with the RhoQ community."
  },
  {
    emoji: "🏋️",
    title: "Work out together",
    body: "Join live workout rooms and train alongside others."
  },
  {
    emoji: "🎯",
    title: "Stay on track",
    body: "Keep your plan in one place and know what to do next."
  },
  {
    emoji: "💪",
    title: "Build your routine",
    body: "Turn your plan into a habit with consistent workouts."
  },
  {
    emoji: "🏆",
    title: "Celebrate your wins",
    body: "Share your milestones and get inspired by others."
  },
  {
    emoji: "⚡",
    title: "Make every workout count",
    body: "Follow your plan, track your work, and keep moving forward."
  }
] as const;

const GENERATE_STEP_MS = 5200;
const GENERATE_TARGETS = [20, 40, 60, 80, 92] as const;

export function PlanGeneratingScreen({ ready }: { ready: boolean }) {
  const [progress, setProgress] = useState(ready ? 78 : 4);
  const [stepIndex, setStepIndex] = useState(
    ready ? GENERATE_STEPS.length - 1 : 0
  );
  const [featureIndex, setFeatureIndex] = useState(0);

  useEffect(() => {
    if (ready) {
      const started = Date.now();
      const tick = window.setInterval(() => {
        const t = Math.min(1, (Date.now() - started) / REVEAL_HOLD_MS);
        const eased = 1 - (1 - t) * (1 - t);
        setProgress(78 + 20 * eased);
        setStepIndex(GENERATE_STEPS.length - 1);
      }, 80);
      return () => window.clearInterval(tick);
    }

    const started = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const nextStep = Math.min(
        GENERATE_STEPS.length - 1,
        Math.floor(elapsed / GENERATE_STEP_MS)
      );
      const prevTarget = nextStep === 0 ? 0 : GENERATE_TARGETS[nextStep - 1];
      const target = GENERATE_TARGETS[nextStep] ?? 92;
      const stepElapsed = elapsed - nextStep * GENERATE_STEP_MS;
      const t = Math.min(1, stepElapsed / GENERATE_STEP_MS);
      const eased = 1 - (1 - t) * (1 - t);
      const value = (prevTarget ?? 0) + (target - (prevTarget ?? 0)) * eased;
      setStepIndex(nextStep);
      setProgress(Math.min(92, value));
    }, 80);
    return () => window.clearInterval(tick);
  }, [ready]);

  useEffect(() => {
    const rotate = window.setInterval(() => {
      setFeatureIndex((index) => (index + 1) % FEATURE_CARDS.length);
    }, 4500);
    return () => window.clearInterval(rotate);
  }, []);

  const feature = FEATURE_CARDS[featureIndex] ?? FEATURE_CARDS[0];
  const percent = Math.round(progress);

  if (!feature) return null;

  return (
    <section className="plan-generating" aria-labelledby="plan-generating-title">
      <p className="plan-kicker">{ready ? "Almost there" : "Building"}</p>
      <h1 id="plan-generating-title">
        {ready
          ? "Putting on the finishing touches"
          : "Your workout is coming together"}
      </h1>

      <div
        className="plan-gen-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Plan generation progress"
      >
        <div className="plan-gen-progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <strong>{percent}%</strong>
      </div>

      <ol className="plan-gen-steps">
        {GENERATE_STEPS.map((label, index) => {
          const done = index < stepIndex || ready;
          const current = !ready && index === stepIndex;
          return (
            <li
              key={label}
              className={done ? "is-done" : current ? "is-current" : undefined}
            >
              <span aria-hidden>{done ? "✓" : current ? "●" : "○"}</span>
              {label}
            </li>
          );
        })}
      </ol>

      <div className="plan-gen-more">
        <h2>More on RhoQ</h2>
        <article className="plan-gen-feature" key={feature.title}>
          <p className="plan-gen-feature-kicker">
            <span aria-hidden>{feature.emoji}</span> {feature.title}
          </p>
          <p>{feature.body}</p>
        </article>
      </div>
    </section>
  );
}
