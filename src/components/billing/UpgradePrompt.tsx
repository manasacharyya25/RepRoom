"use client";

import Link from "next/link";
import type { UpgradeReason } from "@/lib/entitlements";

const COPY: Record<
  UpgradeReason,
  { title: string; body: string; primary: string; primaryHref?: string }
> = {
  locked_room: {
    title: "Sign in to unlock rooms",
    body: "Guests can try Yoga. Create a free account to open every live room.",
    primary: "Sign in",
    primaryHref: "/login?next=/rooms"
  },
  guest_time: {
    title: "Daily guest time is up",
    body: "You’ve used your 10 minutes for today. Sign in for 30 minutes of rooms each day.",
    primary: "Sign in",
    primaryHref: "/login?next=/rooms"
  },
  guest_feed_action: {
    title: "Join the community",
    body: "Sign in to post, like, and comment with other athletes.",
    primary: "Sign in",
    primaryHref: "/login?next=/feed"
  },
  guest_feed_end: {
    title: "See the full feed",
    body: "You’re at the guest preview limit. Sign in for the complete community feed.",
    primary: "Sign in",
    primaryHref: "/login?next=/feed"
  },
  free_time: {
    title: "Go Premium for unlimited rooms",
    body: "Your 30 free minutes for today are done. Upgrade for unlimited live room time.",
    primary: "Upgrade (demo)"
  },
  soft_upgrade: {
    title: "Train without limits",
    body: "Premium unlocks unlimited daily time in every room.",
    primary: "Upgrade (demo)"
  }
};

type UpgradePromptProps = {
  reason: UpgradeReason;
  open: boolean;
  onClose: () => void;
  onStubUpgrade?: () => void | Promise<void>;
  busy?: boolean;
};

export function UpgradePrompt({
  reason,
  open,
  onClose,
  onStubUpgrade,
  busy
}: UpgradePromptProps) {
  if (!open) return null;
  const copy = COPY[reason];
  const isPremiumCta =
    reason === "free_time" || reason === "soft_upgrade";

  return (
    <div
      className="upgrade-prompt-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="upgrade-prompt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-prompt-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="upgrade-prompt-title">{copy.title}</h3>
        <p>{copy.body}</p>
        <div className="upgrade-prompt-actions">
          <button
            type="button"
            className="upgrade-prompt-btn upgrade-prompt-btn--ghost"
            onClick={onClose}
          >
            Not now
          </button>
          {isPremiumCta ? (
            <button
              type="button"
              className="upgrade-prompt-btn"
              disabled={busy}
              onClick={() => void onStubUpgrade?.()}
            >
              {busy ? "Upgrading…" : copy.primary}
            </button>
          ) : (
            <Link
              className="upgrade-prompt-btn"
              href={copy.primaryHref || "/login"}
            >
              {copy.primary}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
