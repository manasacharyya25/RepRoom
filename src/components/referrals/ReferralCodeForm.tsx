"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

export function ReferralCodeForm({
  onApplied
}: {
  onApplied?: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/referrals/me")
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as {
          referredBy?: boolean;
          pendingCode?: string | null;
        } | null;
        if (cancelled || !response.ok) return;
        if (data?.referredBy) {
          setHidden(true);
          return;
        }
        if (data?.pendingCode) {
          setCode((current) => current || data.pendingCode || "");
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const trimmed = code.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/referrals/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: trimmed })
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Could not apply that code.");
        }
        setDone(true);
        setHidden(true);
        onApplied?.();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not apply that code."
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, code, onApplied]
  );

  if (hidden && !done) return null;

  if (done) {
    return (
      <p className="referral-apply-done">Referral code applied. Welcome in.</p>
    );
  }

  return (
    <form className="referral-apply-form" onSubmit={(event) => void submit(event)}>
      <label htmlFor="profile-referral-code">Have a referral code?</label>
      <div className="referral-apply-row">
        <input
          id="profile-referral-code"
          autoComplete="off"
          maxLength={12}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Enter code"
          spellCheck={false}
          type="text"
          value={code}
        />
        <button
          type="submit"
          className="btn-secondary"
          disabled={busy || !code.trim()}
        >
          {busy ? "Saving…" : "Apply"}
        </button>
      </div>
      {error ? <p className="referral-error">{error}</p> : null}
    </form>
  );
}
