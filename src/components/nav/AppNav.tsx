"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { InboxDrawer } from "@/components/inbox/InboxDrawer";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { createClient } from "@/lib/supabase/client";
import "@/app/inbox.css";

async function signOutAndRedirect(router: ReturnType<typeof useRouter>) {
  const supabase = createClient();
  await supabase.auth.signOut();
  router.replace("/login");
  router.refresh();
}

type AppNavProps = {
  /** feed: Rooms + Inbox + Profile. profile: Rooms/Feed/Inbox + Log out. */
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

function AppNavInner({
  variant = "default",
  defaultInboxOpen = false,
  onInboxClose
}: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dmUserId = searchParams.get("dm");
  const [inboxOpen, setInboxOpen] = useState(false);
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(null);

  const clearDmQuery = useCallback(() => {
    if (!searchParams.has("dm")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("dm");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!dmUserId) return;
    setActiveDmUserId(dmUserId);
    setInboxOpen(true);
  }, [dmUserId]);

  useEffect(() => {
    if (!defaultInboxOpen) return;
    const frame = window.requestAnimationFrame(() => setInboxOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [defaultInboxOpen]);

  const closeInbox = () => {
    setInboxOpen(false);
    setActiveDmUserId(null);
    clearDmQuery();
    onInboxClose?.();
  };

  const openInbox = () => {
    setInboxOpen(true);
  };

  const inboxButton = (
    <button
      type="button"
      className={
        inboxOpen || pathname === "/inbox"
          ? "btn-secondary is-active"
          : "btn-secondary"
      }
      aria-expanded={inboxOpen}
      onClick={openInbox}
    >
      Inbox
    </button>
  );

  const drawer = (
    <InboxDrawer
      open={inboxOpen}
      onClose={closeInbox}
      initialUserId={activeDmUserId}
      onOpenedTarget={clearDmQuery}
    />
  );

  if (variant === "feed") {
    return (
      <>
        <header className="landing-nav">
          <Logo />
          <div className="landing-nav-actions">
            <ThemeSwitch />
            <Link className="btn-secondary" href="/rooms">
              Rooms
            </Link>
            {inboxButton}
            <Link className="btn-primary" href="/profile">
              Profile
            </Link>
          </div>
        </header>
        {drawer}
      </>
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
            {inboxButton}
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void signOutAndRedirect(router);
              }}
            >
              Log out
            </button>
          </nav>
        </header>
        {drawer}
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
          onClick={() => {
            void signOutAndRedirect(router);
          }}
        >
          Log out
        </button>
      </div>
    </header>
  );
}

export function AppNav(props: AppNavProps) {
  return (
    <Suspense fallback={<header className="landing-nav" aria-hidden />}>
      <AppNavInner {...props} />
    </Suspense>
  );
}
