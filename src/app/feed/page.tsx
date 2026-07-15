"use client";

import { useEffect, useState } from "react";
import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { AppNav } from "@/components/nav/AppNav";
import { GUEST_FEED_LIMIT, type UpgradeReason } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/client";
import "@/app/landing.css";
import "@/app/feed.css";
import "@/app/billing.css";

export default function FeedPage() {
  const [ready, setReady] = useState(false);
  const [isGuest, setIsGuest] = useState(true);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!cancelled) {
        setIsGuest(!user);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="feed-page">
      <AppNav variant="feed" />
      <main className="feed-page-main">
        {ready ? (
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
          <p className="feed-posts-status">Loading feed…</p>
        )}
      </main>
      <UpgradePrompt
        open={Boolean(upgradeReason)}
        reason={upgradeReason ?? "guest_feed_action"}
        onClose={() => setUpgradeReason(null)}
      />
    </div>
  );
}
