import { OnboardingPage } from "@/components/onboarding/OnboardingPage";
import "@/app/onboarding.css";

export const metadata = {
  title: "Welcome — Satara",
  description: "Set up your Satara profile, preferences, and fitness goals."
};

export default function OnboardingRoute() {
  return <OnboardingPage />;
}
