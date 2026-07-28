"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { GUEST_FEED_LIMIT, type UpgradeReason } from "@/lib/entitlements";

export default function FeedPage() {
  const { authReady, isSignedIn } = useAuth();
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(
    null
  );
  const isGuest = !isSignedIn;

  return (
    <>
      <main className="feed-page-main">
        {authReady ? (
          <CommunityFeed
            allowComments={!isGuest}
            enableLoadMore={!isGuest}
            guestLimit={isGuest ? GUEST_FEED_LIMIT : undefined}
            hideHeader
            className="feed-page-panel"
            readOnly={isGuest}
            onUpgradeRequest={(reason) => setUpgradeReason(reason)}
          />
        ) : (
          <div className="app-route-loading" role="status" aria-live="polite">
            <div className="app-route-loading-spinner" aria-hidden="true" />
            <p>Loading feed…</p>
          </div>
        )}
      </main>
      <UpgradePrompt
        open={Boolean(upgradeReason)}
        reason={upgradeReason ?? "guest_feed_action"}
        onClose={() => setUpgradeReason(null)}
      />
    </>
  );
}
