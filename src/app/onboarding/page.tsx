import { Suspense } from "react";
import { OnboardingPage } from "@/components/onboarding/OnboardingPage";
import "@/app/onboarding.css";

export const metadata = {
  title: "Welcome — RhoQ",
  description: "Set up your RhoQ profile, preferences, and fitness goals."
};

export default function OnboardingRoute() {
  return (
    <Suspense fallback={<div className="onboarding-page" aria-busy="true" />}>
      <OnboardingPage />
    </Suspense>
  );
}
