"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { EntitlementsProvider } from "@/components/auth/EntitlementsProvider";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <EntitlementsProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </EntitlementsProvider>
    </AuthProvider>
  );
}
