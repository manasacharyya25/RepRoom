"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "@/app/landing.css";
import "@/app/onboarding.css";
import "@/app/plan.css";
import { Logo } from "@/components/brand/Logo";
import { PlanReviewView } from "@/components/plan/PlanReviewView";
import { readFreePlanDraft } from "@/lib/free-plan-draft";
import { completeOnboarding } from "@/lib/onboarding";
import {
  clearOnboardingDraft,
  personalFromFreePlanLifestyle,
  readOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraft
} from "@/lib/onboarding-draft";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeWorkoutPlan,
  scalePlanToSessionDuration,
  type WorkoutPlan
} from "@/lib/workout-plan";

const STEPS = [
  { id: "identity", label: "Profile" },
  { id: "context", label: "You" },
  { id: "goals", label: "Goals" },
  { id: "plan", label: "Plan" }
] as const;

const FROM_PLAN_STEPS = [
  { id: "identity", label: "Profile" },
  { id: "goals", label: "Goals" },
  { id: "plan", label: "Plan" }
] as const;

export function OnboardingPlanPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setPlan(scalePlanToSessionDuration(existingPlan));
          setLoading(false);
          return;
        }

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

        const generated = scalePlanToSessionDuration(
          normalizeWorkoutPlan(payload.plan) ?? payload.plan
        );
        const nextDraft = { ...existing, workoutPlan: generated };
        saveOnboardingDraft(nextDraft);
        setDraft(nextDraft);
        setPlan(generated);
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

  const enterRhoq = async () => {
    if (!draft || !plan || saving) return;
    setSaving(true);
    setError(null);
    try {
      const timezone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "";

      const fromLife = personalFromFreePlanLifestyle(
        readFreePlanDraft()?.lifestyle
      );
      const youStepUnset =
        !draft.ageRange && !draft.gender && !draft.activityLevel;

      await completeOnboarding(supabase, {
        displayName: draft.displayName,
        username: draft.username,
        bio: draft.bio,
        avatarUrl: draft.avatarUrl,
        avatarFile: null,
        ageRange: draft.ageRange || fromLife.ageRange,
        gender: draft.gender || fromLife.gender,
        activityLevel: draft.activityLevel || fromLife.activityLevel,
        fitnessExperience: draft.fitnessExperience,
        countryCode: "",
        timezone,
        heightCm:
          youStepUnset && fromLife.heightCm != null
            ? fromLife.heightCm
            : draft.heightCm ?? fromLife.heightCm,
        currentWeightKg:
          youStepUnset && fromLife.currentWeightKg != null
            ? fromLife.currentWeightKg
            : draft.currentWeightKg ?? fromLife.currentWeightKg,
        targetWeightKg: null,
        weightUnit: youStepUnset
          ? fromLife.weightUnit || draft.weightUnit
          : draft.weightUnit || fromLife.weightUnit,
        primaryFitnessGoal: draft.primaryFitnessGoal,
        workoutDaysPerWeek: draft.workoutDaysPerWeek,
        sessionMinutes: draft.sessionMinutes,
        successMilestone: draft.successMilestone,
        workoutPlanStatus: draft.workoutPlanStatus,
        workoutPlan: plan,
        goals: draft.goals,
        skipped: false,
        fromPlan: Boolean(draft.fromPlan)
      });

      clearOnboardingDraft();
      await fetch("/api/onboarding/complete-cookie", { method: "POST" }).catch(
        () => null
      );
      router.replace(draft.fromPlan ? "/profile" : "/rooms");
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

  const backHref = draft?.fromPlan
    ? "/onboarding?step=goals"
    : "/onboarding?step=plan";
  const freeDraft = readFreePlanDraft();
  const fromPlan = Boolean(draft?.fromPlan) || Boolean(freeDraft?.plan);
  const progressSteps = fromPlan ? FROM_PLAN_STEPS : STEPS;
  const planStepIndex = progressSteps.length - 1;

  return (
    <div className="plan-page plan-page--review">
      <header className="landing-nav plan-nav">
        <Logo />
      </header>

      <main className="plan-main">
        <div className="onboarding-progress" aria-label="Onboarding progress">
          {progressSteps.map((item, index) => (
            <div
              key={item.id}
              className={`onboarding-progress-step${
                index === planStepIndex ? " is-active" : ""
              }${index < planStepIndex ? " is-done" : ""}`}
            >
              <span className="onboarding-progress-dot" aria-hidden />
              <span className="onboarding-progress-label">{item.label}</span>
            </div>
          ))}
        </div>

        {loading || !plan ? (
          <div
            className="onboarding-plan-loading"
            role="status"
            aria-live="polite"
          >
            <div className="onboarding-plan-loading-spinner" aria-hidden />
            <strong>Loading your workout plan…</strong>
          </div>
        ) : (
          <PlanReviewView
            plan={plan}
            focus={freeDraft?.focus}
            equipment={freeDraft?.equipment}
            style={freeDraft?.style}
            error={error}
            toolbar={
              <div className="plan-review-toolbar">
                <Link className="plan-back" href={backHref}>
                  ← Back
                </Link>
              </div>
            }
            footer={
              <div className="plan-review-cta">
                <Link className="btn-secondary" href={backHref}>
                  Back
                </Link>
                <button
                  type="button"
                  className="btn-primary btn-primary-lg"
                  disabled={saving || loading || !plan}
                  onClick={() => void enterRhoq()}
                >
                  {saving
                    ? "Saving…"
                    : draft?.fromPlan
                      ? "Start your fitness journey"
                      : "Enter RhoQ"}
                </button>
              </div>
            }
          />
        )}
      </main>
    </div>
  );
}
