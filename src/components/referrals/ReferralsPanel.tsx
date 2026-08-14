"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { LIVE_IMAGES } from "@/lib/live-images";
import type { ReferralMeResponse, ReferralPerson } from "@/lib/referrals";

function isRemoteSrc(src: string) {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("blob:")
  );
}

function formatJoined(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function ReferralsPanel({
  onBack,
  onClose
}: {
  onBack: () => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReferralMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applied, setApplied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/referrals/me");
      const payload = (await response.json().catch(() => null)) as
        | (ReferralMeResponse & { error?: string })
        | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Could not load referrals.");
      }
      setData(payload);
      setApplied(Boolean(payload.revenueShareInterested));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load referrals."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async () => {
    if (applyBusy) return;
    setApplyBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/referrals/interest", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Could not submit application.");
      }
      setApplied(true);
      setData((current) =>
        current ? { ...current, revenueShareInterested: true } : current
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not submit application."
      );
    } finally {
      setApplyBusy(false);
    }
  };

  const eligible = Boolean(data?.revenueShareEligible);
  const goal = data?.goal ?? 10;
  const premiumCount = data?.premiumCount ?? 0;
  const people = data?.referrals ?? [];

  return (
    <div className="account-panel">
      <header className="notif-drawer-header">
        <button
          type="button"
          className="notif-drawer-close"
          aria-label="Back"
          onClick={onBack}
        >
          ←
        </button>
        <div className="notif-drawer-title">
          <strong>Referrals</strong>
          <span>
            {loading
              ? "Loading…"
              : eligible
                ? `${premiumCount}/${goal} premium`
                : "Revenue sharing"}
          </span>
        </div>
        <div className="notif-drawer-header-actions">
          <button
            type="button"
            className="notif-drawer-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>

      <div className="account-panel-body">
        {error ? <p className="referral-error">{error}</p> : null}

        {!loading && data && !eligible ? (
          <div className="referral-gated">
            <h3>Not eligible yet</h3>
            <p>
              Revenue sharing pays ₹1,000 when 10 people you invite buy
              Premium. This program isn’t open to every account.
            </p>
            {applied || data.revenueShareInterested ? (
              <p className="referral-gated-done">Application received.</p>
            ) : (
              <button
                type="button"
                className="btn-primary"
                disabled={applyBusy}
                onClick={() => void apply()}
              >
                {applyBusy ? "Applying…" : "Apply"}
              </button>
            )}
          </div>
        ) : null}

        {!loading && eligible ? (
          <>
            <div className="referral-progress">
              <strong>
                {premiumCount}/{goal}
              </strong>
              <p>
                {premiumCount >= goal
                  ? "You’ve unlocked ₹1,000 in revenue sharing."
                  : `Invite friends to RhoQ. You’re eligible for ₹1,000 when ${goal} of them buy Premium.`}
              </p>
              <div
                className="referral-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={goal}
                aria-valuenow={Math.min(premiumCount, goal)}
              >
                <span
                  className="referral-progress-fill"
                  style={{
                    width: `${Math.min(100, (premiumCount / goal) * 100)}%`
                  }}
                />
              </div>
            </div>

            {people.length === 0 ? (
              <p className="notif-empty">
                No one has signed up with your code yet. Share your invite link
                from your profile.
              </p>
            ) : (
              <ul className="referral-people">
                {people.map((person) => (
                  <ReferralPersonRow key={person.id} person={person} />
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function ReferralPersonRow({ person }: { person: ReferralPerson }) {
  const avatar = person.avatarUrl || LIVE_IMAGES.participant4;
  return (
    <li className="referral-person">
      <span className="notif-avatar">
        <Image
          alt=""
          className="notif-avatar-image"
          fill
          sizes="44px"
          src={avatar}
          unoptimized={isRemoteSrc(avatar)}
        />
      </span>
      <span className="referral-person-copy">
        <strong>{person.displayName}</strong>
        <span>
          {person.username ? `@${person.username}` : "Signed up"}
          {person.createdAt ? ` · ${formatJoined(person.createdAt)}` : ""}
        </span>
      </span>
      <span
        className={`referral-person-status${
          person.premium ? " is-premium" : ""
        }`}
      >
        {person.premium ? "Premium" : "Signed up"}
      </span>
    </li>
  );
}
