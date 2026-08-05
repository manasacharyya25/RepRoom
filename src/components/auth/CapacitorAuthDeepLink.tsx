"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import {
  isCapacitorAuthCallbackUrl,
  isNativeApp,
  parseAuthCallbackUrl
} from "@/lib/capacitor-auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Completes Supabase OAuth when the native app opens the custom-scheme deep link.
 * Web auth continues to use `/auth/callback` (server route).
 */
export function CapacitorAuthDeepLink() {
  const router = useRouter();
  const handlingRef = useRef(false);

  useEffect(() => {
    if (!isNativeApp()) return;

    const supabase = createClient();
    let cancelled = false;

    const handleUrl = async (url: string) => {
      if (cancelled || !isCapacitorAuthCallbackUrl(url)) return;
      if (handlingRef.current) return;
      handlingRef.current = true;

      try {
        const { code, error: authError, nextPath } = parseAuthCallbackUrl(url);
        await Browser.close().catch(() => {
          /* browser may already be closed */
        });

        if (authError || !code) {
          router.replace("/login?error=auth");
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          console.error("[capacitor-auth]", error.message);
          router.replace("/login?error=auth");
          return;
        }

        router.replace(nextPath);
        router.refresh();
      } finally {
        handlingRef.current = false;
      }
    };

    void App.getLaunchUrl()
      .then((result) => {
        if (result?.url) void handleUrl(result.url);
      })
      .catch(() => {
        /* no launch URL */
      });

    const listener = App.addListener("appUrlOpen", (event) => {
      void handleUrl(event.url);
    });

    return () => {
      cancelled = true;
      void listener.then((handle) => handle.remove());
    };
  }, [router]);

  return null;
}
