"use client";

import { useState, type FormEvent } from "react";

type WaitlistFormProps = {
  source?: string;
  size?: "default" | "large";
};

export function WaitlistForm({
  source = "landing",
  size = "default"
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "loading") return;

    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source })
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        alreadyJoined?: boolean;
      } | null;

      if (!response.ok) {
        setStatus("error");
        setMessage(data?.error ?? "Could not join the waitlist.");
        return;
      }

      setStatus("success");
      setMessage(
        data?.alreadyJoined
          ? "You’re already on the list. We’ll be in touch."
          : "You’re on the list. We’ll email you when RhoQ opens."
      );
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Could not join the waitlist. Try again.");
    }
  };

  if (status === "success") {
    return (
      <p className="waitlist-success" role="status">
        {message}
      </p>
    );
  }

  return (
    <form
      className={`waitlist-form${size === "large" ? " waitlist-form--large" : ""}`}
      onSubmit={(event) => void onSubmit(event)}
    >
      <div className="waitlist-field">
        <label
          className="waitlist-field-label"
          htmlFor={`waitlist-email-${source}`}
        >
          Email
        </label>
        <span className="waitlist-field-divider" aria-hidden />
        <input
          id={`waitlist-email-${source}`}
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="Enter your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === "loading"}
        />
      </div>
      <button
        type="submit"
        className={`btn-primary waitlist-submit${
          size === "large" ? " btn-primary-lg" : ""
        }`}
        disabled={status === "loading"}
      >
        {status === "loading" ? "Joining…" : "Join waitlist"}
      </button>
      {message && status === "error" ? (
        <p className="waitlist-error" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
