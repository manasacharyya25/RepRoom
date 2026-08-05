"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import "@/app/landing.css";
import "@/app/login.css";
import { BrandMark, BrandName, Logo } from "@/components/brand/Logo";
import { buildAuthCallbackUrl, isNativeApp } from "@/lib/capacitor-auth";
import { createClient } from "@/lib/supabase/client";
import { Browser } from "@capacitor/browser";

type Mode = "signin" | "signup";

function GoogleIcon() {
  return (
    <svg aria-hidden className="login-google-icon" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/rooms";
  const authError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    authError ? "Could not complete sign-in. Please try again." : null
  );
  const [info, setInfo] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const title = mode === "signin" ? "Welcome back" : "Create your account";
  const submitLabel =
    mode === "signin" ? "Sign in with email" : "Create account";

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (signInError) throw signInError;
        router.replace(nextPath);
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(nextPath)
        }
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      setInfo("Check your email to confirm your account, then sign in.");
      setMode("signin");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);

    const redirectTo = buildAuthCallbackUrl(nextPath);

    try {
      if (isNativeApp()) {
        const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            skipBrowserRedirect: true
          }
        });
        if (oauthError) throw oauthError;
        if (!data.url) {
          throw new Error("Could not start Google sign-in.");
        }
        await Browser.open({ url: data.url });
        return;
      }

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo }
      });
      if (oauthError) throw oauthError;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not start Google sign-in."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <header className="landing-nav login-nav">
        <Logo />
      </header>

      <main className="login-stage">
        <div className="login-visual" aria-hidden>
          <div className="login-visual-glow" />
          <div className="login-visual-copy">
            <p className="login-visual-kicker">Live rooms · Feed · Buddies</p>
            <p className="login-visual-line">
              Work out together.
              <br />
              Motivate each other.
            </p>
          </div>
        </div>

        <section className="login-panel" aria-labelledby="login-heading">
          <button
            type="button"
            className="login-google"
            disabled={busy}
            onClick={() => {
              void handleGoogle();
            }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="login-divider" role="separator">
            <span>or email</span>
          </div>

          <div className="login-mode-toggle" role="tablist" aria-label="Auth mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "is-active" : undefined}
              onClick={() => {
                setMode("signin");
                setError(null);
                setInfo(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "is-active" : undefined}
              onClick={() => {
                setMode("signup");
                setError(null);
                setInfo(null);
              }}
            >
              Sign up
            </button>
          </div>

          <form className="login-form" onSubmit={handleEmailAuth}>
            <label className="login-field">
              <span>Email</span>
              <input
                autoComplete="email"
                disabled={busy}
                inputMode="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <input
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                disabled={busy}
                minLength={6}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                required
                type="password"
                value={password}
              />
            </label>

            {error ? (
              <p className="login-message login-message--error" role="alert">
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="login-message login-message--info" role="status">
                {info}
              </p>
            ) : null}

            <button className="btn-primary login-submit" disabled={busy} type="submit">
              {busy ? "Please wait…" : submitLabel}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
