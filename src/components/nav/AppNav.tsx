"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { InboxDrawer } from "@/components/inbox/InboxDrawer";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import "@/app/inbox.css";

type AppNavProps = {
  /** feed: Rooms (white) + Profile (orange). profile: Rooms/Feed/Inbox + Log out. */
  variant?: "default" | "feed" | "profile";
  /** Open the inbox drawer on mount (used by /inbox). */
  defaultInboxOpen?: boolean;
  /** Called when the inbox drawer is closed. */
  onInboxClose?: () => void;
};

function Logo() {
  return (
    <Link className="landing-logo" href="/">
      <span className="landing-logo-mark" aria-hidden>
        S
      </span>
      Satara
    </Link>
  );
}

export function AppNav({
  variant = "default",
  defaultInboxOpen = false,
  onInboxClose
}: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [inboxOpen, setInboxOpen] = useState(false);

  useEffect(() => {
    if (!defaultInboxOpen) {
      setInboxOpen(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setInboxOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [defaultInboxOpen]);

  const closeInbox = () => {
    setInboxOpen(false);
    onInboxClose?.();
  };

  if (variant === "feed") {
    return (
      <header className="landing-nav">
        <Logo />
        <div className="landing-nav-actions">
          <ThemeSwitch />
          <Link className="btn-secondary" href="/rooms">
            Rooms
          </Link>
          <Link className="btn-primary" href="/profile">
            Profile
          </Link>
        </div>
      </header>
    );
  }

  if (variant === "profile") {
    const links = [
      { href: "/rooms", label: "Rooms" },
      { href: "/feed", label: "Feed" }
    ] as const;

    return (
      <>
        <header className="landing-nav">
          <Logo />
          <nav className="landing-nav-actions profile-nav-pills" aria-label="Main">
            <ThemeSwitch />
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive ? "btn-secondary is-active" : "btn-secondary"}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              type="button"
              className={
                inboxOpen || pathname === "/inbox"
                  ? "btn-secondary is-active"
                  : "btn-secondary"
              }
              aria-expanded={inboxOpen}
              onClick={() => {
                if (pathname === "/profile" || pathname === "/inbox") {
                  setInboxOpen(true);
                  return;
                }
                router.push("/inbox");
              }}
            >
              Inbox
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => router.push("/")}
            >
              Log out
            </button>
          </nav>
        </header>
        <InboxDrawer open={inboxOpen} onClose={closeInbox} />
      </>
    );
  }

  return (
    <header className="landing-nav">
      <Logo />
      <div className="landing-nav-actions">
        <ThemeSwitch />
        <Link className="btn-secondary" href="/profile">
          Profile
        </Link>
        <button
          type="button"
          className="btn-primary"
          onClick={() => router.push("/")}
        >
          Log out
        </button>
      </div>
    </header>
  );
}
