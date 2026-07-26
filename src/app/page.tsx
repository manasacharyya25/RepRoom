import { LandingPage } from "@/components/landing/LandingPage";
import { isWaitlistMode } from "@/lib/waitlist";

export default function HomePage() {
  return <LandingPage waitlistMode={isWaitlistMode()} />;
}
