"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { EntitlementsProvider } from "@/components/auth/EntitlementsProvider";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <EntitlementsProvider>
        <NotificationsProvider>
          <PwaInstallProvider>{children}</PwaInstallProvider>
        </NotificationsProvider>
      </EntitlementsProvider>
    </AuthProvider>
  );
}
