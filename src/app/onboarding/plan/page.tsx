import { OnboardingPlanPage } from "@/components/onboarding/OnboardingPlanPage";
import "@/app/onboarding.css";

export const metadata = {
  title: "Your Plan — RhoQ",
  description: "Review your personalized RhoQ workout plan."
};

export default function OnboardingPlanRoute() {
  return <OnboardingPlanPage />;
}
