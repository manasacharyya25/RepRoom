"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BrandName } from "@/components/brand/Logo";
import { useEntitlements } from "@/components/auth/EntitlementsProvider";
import "@/app/billing.css";

export default function BillingSuccessPage() {
  const { refreshStatus } = useEntitlements();

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  return (
    <div className="billing-success">
      <header className="billing-success-nav">
        <BrandName height={36} />
      </header>
      <main className="billing-success-main">
        <h1>You&apos;re all set</h1>
        <p>
          Thanks for supporting RhoQ. If you just subscribed or bought hours,
          your access updates within a few seconds after payment confirms.
        </p>
        <div className="billing-success-actions">
          <Link className="upgrade-prompt-btn" href="/rooms">
            Go to rooms
          </Link>
          <Link
            className="upgrade-prompt-btn upgrade-prompt-btn--ghost"
            href="/feed"
          >
            Open feed
          </Link>
        </div>
      </main>
    </div>
  );
}
