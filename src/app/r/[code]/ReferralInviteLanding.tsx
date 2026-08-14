"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { writeStoredReferralCode } from "@/lib/referral-storage";
import { normalizeReferralCode } from "@/lib/referrals";
import "@/app/login.css";

export function ReferralInviteLanding({ code }: { code: string }) {
  const router = useRouter();

  useEffect(() => {
    const normalized = normalizeReferralCode(code);
    if (normalized) {
      writeStoredReferralCode(normalized);
    }
    const next = new URLSearchParams({
      mode: "signup",
      next: "/onboarding"
    });
    if (normalized) {
      next.set("ref", normalized);
    }
    router.replace(`/login?${next.toString()}`);
  }, [code, router]);

  return (
    <main className="login-page">
      <p className="login-subheading" style={{ padding: "48px 24px" }}>
        Taking you to sign up…
      </p>
    </main>
  );
}
