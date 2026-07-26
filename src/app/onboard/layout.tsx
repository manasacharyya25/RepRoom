import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ONBOARD_OG_IMAGE } from "@/lib/site-url";

const title = "RhoQ — Record your first workout";
const description =
  "You’re invited to RhoQ. Record a short workout intro and get ready for live rooms with people who train like you.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "RhoQ",
  openGraph: {
    type: "website",
    siteName: "RhoQ",
    title,
    description,
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

export default function OnboardLayout({ children }: { children: ReactNode }) {
  return children;
}
