import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Satara — Work out together. Motivate each other.",
  description:
    "Join live Yoga, Workout, Cardio, Zumba, and Meditation rooms. Motivate each other, share progress, and stay accountable.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png"
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
      </body>
    </html>
  );
}
