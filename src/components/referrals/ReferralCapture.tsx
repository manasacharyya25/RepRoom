"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  clearStoredReferralCode,
  readStoredReferralCode
} from "@/lib/referral-storage";
import { createClient } from "@/lib/supabase/client";

/** Applies a cached invite code once onboarding is already done. */
export function ReferralCapture() {
  const { authReady, isSignedIn, user } = useAuth();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!authReady || !isSignedIn || !user || appliedRef.current) return;
    appliedRef.current = true;

    const run = async () => {
      const stored = readStoredReferralCode();
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed_at, referred_by")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.referred_by) {
        clearStoredReferralCode();
        return;
      }

      // New users confirm or edit the code at Enter RhoQ.
      if (!profile?.onboarding_completed_at) return;

      await fetch("/api/referrals/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: stored ?? undefined })
      }).catch(() => null);
      clearStoredReferralCode();
    };

    void run();
  }, [authReady, isSignedIn, user]);

  useEffect(() => {
    if (!isSignedIn) {
      appliedRef.current = false;
    }
  }, [isSignedIn]);

  return null;
}
