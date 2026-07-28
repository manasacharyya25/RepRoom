import type { ReactNode } from "react";
import { AppShell } from "@/components/nav/AppShell";
import "@/app/landing.css";
import "@/app/feed.css";
import "@/app/profile.css";
import "@/app/billing.css";
import "@/app/live-rooms.css";
import "@/app/inbox.css";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
