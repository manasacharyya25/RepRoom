"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CapacitorAuthDeepLink } from "@/components/auth/CapacitorAuthDeepLink";
import { EntitlementsProvider } from "@/components/auth/EntitlementsProvider";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";
import { ReferralCapture } from "@/components/referrals/ReferralCapture";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CapacitorAuthDeepLink />
      <ReferralCapture />
      <EntitlementsProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </EntitlementsProvider>
    </AuthProvider>
  );
}
