import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AppProviders } from "@/components/providers/AppProviders";
import { DEFAULT_OG_IMAGE, resolveSiteUrl } from "@/lib/site-url";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap"
});

const title = "RhoQ - Workout Together. Motivate Each Other";
const description =
  "Fitness is easier together. Join live Strength Training, Yoga, and Zumba sessions, connect with people who inspire you, celebrate your progress, and stay accountable every step of the way.";

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title,
  description,
  applicationName: "RhoQ",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png"
  },
  openGraph: {
    type: "website",
    siteName: "RhoQ",
    title,
    description,
    images: [DEFAULT_OG_IMAGE]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [DEFAULT_OG_IMAGE.url]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
