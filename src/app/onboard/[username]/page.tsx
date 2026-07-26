import type { Metadata } from "next";
import { OnboardingRecorderPage } from "@/components/onboard/OnboardingRecorderPage";
import { ONBOARD_OG_IMAGE } from "@/lib/site-url";
import "@/app/onboard-recorder.css";

type PageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({
  params
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  const slug = username.trim().toLowerCase() || "friend";
  const title = `You’re invited to RhoQ — @${slug}`;
  const description =
    "Record a short workout intro and get ready for RhoQ’s live rooms. Work out together. Motivate each other.";

  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "RhoQ",
      title,
      description,
      url: `/onboard/${encodeURIComponent(slug)}`,
      images: [ONBOARD_OG_IMAGE]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ONBOARD_OG_IMAGE.url]
    },
    robots: {
      index: false,
      follow: false
    }
  };
}

export default async function OnboardRecorderRoute({ params }: PageProps) {
  const { username } = await params;
  const slug = username.trim().toLowerCase();

  return <OnboardingRecorderPage username={slug} />;
}
