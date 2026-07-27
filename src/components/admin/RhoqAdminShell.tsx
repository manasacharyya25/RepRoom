"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { BrandName } from "@/components/brand/Logo";

type RhoqAdminShellProps = {
  children: ReactNode;
  wide?: boolean;
};

const NAV = [
  { href: "/rhoq-admin", label: "Onboard", match: "exact" as const },
  { href: "/rhoq-admin/waitlist", label: "Waitlist", match: "prefix" as const }
];

export function RhoqAdminShell({ children, wide }: RhoqAdminShellProps) {
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const refreshAuth = useCallback(async () => {
    const response = await fetch("/api/rhoq-admin/status");
    const data = (await response.json().catch(() => null)) as {
      authenticated?: boolean;
    } | null;
    return Boolean(data?.authenticated);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ok = await refreshAuth();
        if (!cancelled) setAuthenticated(ok);
      } catch {
        if (!cancelled) setAuthenticated(false);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAuth]);

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const response = await fetch("/api/rhoq-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Login failed");
      }
      setPassword("");
      setAuthenticated(true);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  }

  async function onLogout() {
    await fetch("/api/rhoq-admin/logout", { method: "POST" });
    setAuthenticated(false);
  }

  function isNavActive(href: string, match: "exact" | "prefix") {
    if (href === "/rhoq-admin") {
      return (
        pathname === "/rhoq-admin" ||
        (pathname.startsWith("/rhoq-admin/") &&
          !pathname.startsWith("/rhoq-admin/waitlist"))
      );
    }
    if (match === "exact") {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="rhoq-admin">
      <header className="rhoq-admin-nav">
        <BrandName height={36} />
        <div className="rhoq-admin-nav-end">
          <span className="rhoq-admin-tag">Admin</span>
          {authenticated ? (
            <button
              className="rhoq-admin-ghost-btn"
              onClick={() => void onLogout()}
              type="button"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      {!authChecked ? (
        <main className="rhoq-admin-main">
          <p className="rhoq-admin-muted">Loading…</p>
        </main>
      ) : !authenticated ? (
        <main className="rhoq-admin-main">
          <form className="rhoq-admin-gate" onSubmit={onLogin}>
            <h1>RhoQ Admin</h1>
            <p className="rhoq-admin-muted">
              Enter the admin password to continue.
            </p>
            <label className="rhoq-admin-label" htmlFor="rhoq-admin-password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="rhoq-admin-input"
              id="rhoq-admin-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            {loginError ? (
              <p className="rhoq-admin-error" role="alert">
                {loginError}
              </p>
            ) : null}
            <button
              className="rhoq-admin-primary-btn"
              disabled={loggingIn || !password}
              type="submit"
            >
              {loggingIn ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </main>
      ) : (
        <div
          className={`rhoq-admin-body${wide ? " rhoq-admin-body--wide" : ""}`}
        >
          <aside className="rhoq-admin-sidebar" aria-label="Admin sections">
            <p className="rhoq-admin-sidebar-label">Menu</p>
            <nav className="rhoq-admin-sidebar-nav">
              {NAV.map((item) => (
                <Link
                  className={`rhoq-admin-sidebar-link${
                    isNavActive(item.href, item.match) ? " is-active" : ""
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="rhoq-admin-content">{children}</main>
        </div>
      )}
    </div>
  );
}
