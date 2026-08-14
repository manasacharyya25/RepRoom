"use client";

import { useEffect, useId, useState } from "react";

export function ReferralShareModal({
  open,
  onClose,
  code,
  shareUrl
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  shareUrl: string;
}) {
  const titleId = useId();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  useEffect(() => {
    if (!open) {
      setCopied(null);
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const copy = async (value: string, kind: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div
      className="referral-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="referral-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="referral-modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <p className="referral-modal-kicker">Invite friends</p>
        <h2 id={titleId}>Here’s your referral code</h2>
        <p className="referral-modal-lead">
          Share this link. When someone signs up with it, they join as your
          workout buddy.
        </p>
        <p className="referral-modal-code" aria-label="Referral code">
          {code}
        </p>
        <p className="referral-modal-link">{shareUrl}</p>
        <div className="referral-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void copy(code, "code")}
          >
            {copied === "code" ? "Copied" : "Copy code"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void copy(shareUrl, "link")}
          >
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
