import { OnboardingRecorderPage } from "@/components/onboard/OnboardingRecorderPage";
import "@/app/onboard-recorder.css";

type PageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params;
  return {
    title: `Record — @${username} — RhoQ`,
    robots: { index: false, follow: false }
  };
}

export default async function OnboardRecorderRoute({ params }: PageProps) {
  const { username } = await params;
  const slug = username.trim().toLowerCase();

  return <OnboardingRecorderPage username={slug} />;
}
