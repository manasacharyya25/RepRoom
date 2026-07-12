import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Satara — Work out together. Motivate each other.",
  description:
    "Join live Yoga, Workout, Cardio, Zumba, and Meditation rooms. Motivate each other, share progress, and stay accountable."
};

const themeBootScript = `
(() => {
  try {
    const stored = localStorage.getItem("satara-theme");
    const theme = stored === "cobalt" || stored === "ember" ? stored : "ember";
    document.documentElement.dataset.theme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = "ember";
  }
})();
`;

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={outfit.className}>{children}</body>
    </html>
  );
}
