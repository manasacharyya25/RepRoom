"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";

type AppNavProps = {
  /** feed: Rooms (white) + Profile (orange). profile: Rooms/Feed/Inbox + Log out. */
  variant?: "default" | "feed" | "profile";
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

export function AppNav({ variant = "default" }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();

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
      { href: "/feed", label: "Feed" },
      { href: "/inbox", label: "Inbox" }
    ] as const;

    return (
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
            className="btn-primary"
            onClick={() => router.push("/")}
          >
            Log out
          </button>
        </nav>
      </header>
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
