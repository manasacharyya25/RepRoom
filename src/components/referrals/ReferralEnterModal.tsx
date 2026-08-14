"use client";

import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { normalizeReferralCode } from "@/lib/referrals";
import "@/app/referrals.css";

const SLOT_COUNT = 8;
const SLOT_CHARS = /^[A-Z0-9]$/;

function toSlots(value: string) {
  const chars = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, SLOT_COUNT);
  return Array.from({ length: SLOT_COUNT }, (_, index) => chars[index] ?? "");
}

function fromSlots(slots: string[]) {
  return slots.join("");
}

export function ReferralEnterModal({
  open,
  initialCode,
  busy,
  error,
  onSkip,
  onAccept
}: {
  open: boolean;
  initialCode?: string;
  busy?: boolean;
  error?: string | null;
  onSkip: () => void;
  onAccept: (code: string) => void;
}) {
  const titleId = useId();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [slots, setSlots] = useState(() => toSlots(initialCode ?? ""));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSlots(toSlots(initialCode ?? ""));
    setLocalError(null);
    const frame = window.requestAnimationFrame(() => {
      const firstEmpty = toSlots(initialCode ?? "").findIndex((cell) => !cell);
      inputRefs.current[firstEmpty === -1 ? 0 : firstEmpty]?.focus();
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, initialCode]);

  if (!open) return null;

  const setSlot = (index: number, raw: string) => {
    const char = raw.toUpperCase().slice(-1);
    if (char && !SLOT_CHARS.test(char)) return;
    setSlots((current) => {
      const next = [...current];
      next[index] = char || "";
      return next;
    });
    setLocalError(null);
    if (char) {
      inputRefs.current[Math.min(index + 1, SLOT_COUNT - 1)]?.focus();
    }
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      setSlots((current) => {
        const next = [...current];
        if (next[index]) {
          next[index] = "";
        } else if (index > 0) {
          next[index - 1] = "";
          inputRefs.current[index - 1]?.focus();
        }
        return next;
      });
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < SLOT_COUNT - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    const next = toSlots(pasted);
    setSlots(next);
    setLocalError(null);
    const firstEmpty = next.findIndex((cell) => !cell);
    inputRefs.current[firstEmpty === -1 ? SLOT_COUNT - 1 : firstEmpty]?.focus();
  };

  const submit = () => {
    const raw = fromSlots(slots);
    if (!raw) {
      onSkip();
      return;
    }
    const normalized = normalizeReferralCode(raw);
    if (!normalized) {
      setLocalError("Enter a valid referral code, or skip.");
      return;
    }
    onAccept(normalized);
  };

  const displayError = localError || error || null;

  return (
    <div className="referral-enter-backdrop" role="presentation">
      <div
        className="referral-enter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>Enter your referral code</h2>
        <div className="referral-enter-slots" onPaste={onPaste}>
          {slots.map((cell, index) => (
            <input
              key={index}
              ref={(node) => {
                inputRefs.current[index] = node;
              }}
              aria-label={`Referral code character ${index + 1}`}
              autoCapitalize="characters"
              autoComplete="off"
              className="referral-enter-slot"
              disabled={busy}
              inputMode="text"
              maxLength={1}
              onChange={(event) => setSlot(index, event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => onKeyDown(index, event)}
              spellCheck={false}
              value={cell}
            />
          ))}
        </div>
        {displayError ? (
          <p className="referral-error" role="alert">
            {displayError}
          </p>
        ) : null}
        <div className="referral-enter-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={onSkip}
          >
            Skip
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Saving…" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
