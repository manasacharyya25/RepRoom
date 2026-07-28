"use client";

import { useState } from "react";
import { usePwaInstall } from "@/components/pwa/PwaInstallProvider";

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none" width="18" height="18">
      <path
        d="M12 4.75v9.5M8.5 10.75 12 14.25l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 17.25h12.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Homescreen CTA on /rooms — always visible on mobile until installed/dismissed.
 * Uses native install prompt when available; otherwise shows manual steps.
 */
export function PwaInstallButton() {
  const {
    isStandalone,
    canInstall,
    isIos,
    isMobile,
    dismissed,
    dismiss,
    install
  } = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  if (isStandalone || dismissed || !isMobile) return null;

  return (
    <div className="pwa-install-banner" role="region" aria-label="Install RhoQ">
      <div className="pwa-install-banner-copy">
        <p className="pwa-install-banner-title">Add RhoQ to your home screen</p>
        <p className="pwa-install-banner-text">
          Launch faster and train in a full-screen app.
        </p>
        {showHelp ? (
          <ol className="pwa-install-ios-steps">
            {isIos ? (
              <>
                <li>
                  Tap the <strong>Share</strong> button in Safari
                </li>
                <li>
                  Choose <strong>Add to Home Screen</strong>
                </li>
                <li>
                  Tap <strong>Add</strong>
                </li>
              </>
            ) : (
              <>
                <li>
                  Open the browser <strong>menu</strong> (⋮)
                </li>
                <li>
                  Tap <strong>Install app</strong> or{" "}
                  <strong>Add to Home screen</strong>
                </li>
                <li>
                  Confirm <strong>Install</strong> / <strong>Add</strong>
                </li>
              </>
            )}
          </ol>
        ) : null}
      </div>
      <div className="pwa-install-banner-actions">
        {canInstall ? (
          <button
            type="button"
            className="pwa-install-btn"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void install().finally(() => setBusy(false));
            }}
          >
            <DownloadIcon />
            {busy ? "Installing…" : "Add to Home Screen"}
          </button>
        ) : (
          <button
            type="button"
            className="pwa-install-btn"
            onClick={() => setShowHelp((open) => !open)}
            aria-expanded={showHelp}
          >
            <DownloadIcon />
            {showHelp ? "Hide steps" : "How to install"}
          </button>
        )}
        <button
          type="button"
          className="pwa-install-dismiss"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
