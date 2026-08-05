"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CapacitorAuthDeepLink } from "@/components/auth/CapacitorAuthDeepLink";
import { EntitlementsProvider } from "@/components/auth/EntitlementsProvider";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CapacitorAuthDeepLink />
      <EntitlementsProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </EntitlementsProvider>
    </AuthProvider>
  );
}
