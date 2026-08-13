import type { Metadata } from "next";
import { FreePlanPage } from "@/components/plan/FreePlanPage";

export const metadata: Metadata = {
  title: "Free Workout Plan Generator — RhoQ",
  description:
    "Build a free personalized workout plan from your goals, schedule, and experience. Sign up to save it to your RhoQ profile."
};

export default function PlanPage() {
  return <FreePlanPage />;
}
