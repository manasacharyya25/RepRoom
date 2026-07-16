"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { InboxDrawer } from "@/components/inbox/InboxDrawer";
import { NotificationsDrawer } from "@/components/notifications/NotificationsDrawer";
import {
  NotificationsProvider,
  useNotifications
} from "@/components/notifications/NotificationsProvider";
import { createClient } from "@/lib/supabase/client";
import "@/app/inbox.css";
import "@/app/notifications.css";

async function signOutAndRedirect(router: ReturnType<typeof useRouter>) {
  const supabase = createClient();
  await supabase.auth.signOut();
  router.replace("/login");
  router.refresh();
}

type AppNavProps = {
  /** feed/rooms: icon Inbox + Notifications. profile: Rooms/Feed + icons + Log out. */
  variant?: "default" | "feed" | "profile" | "rooms";
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

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M4.75 7.75A2 2 0 0 1 6.75 5.75h10.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m5 8.5 5.8 4.2a2 2 0 0 0 2.4 0L19 8.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M12 4.75a5.25 5.25 0 0 0-5.25 5.25v1.7c0 .7-.22 1.38-.62 1.95L5 15.75h14l-1.13-2.1a3.5 3.5 0 0 1-.62-1.95v-1.7A5.25 5.25 0 0 0 12 4.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.75 17.25a2.25 2.25 0 0 0 4.5 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InboxNavButton({
  open,
  onOpen
}: {
  open: boolean;
  onOpen: () => void;
}) {
  const { inboxUnreadCount } = useNotifications();
  const pathname = usePathname();

  return (
    <button
      type="button"
      className={`nav-icon-btn notif-nav-btn${
        open || pathname === "/inbox" ? " is-active" : ""
      }`}
      aria-expanded={open}
      aria-label={
        inboxUnreadCount > 0
          ? `Inbox, ${inboxUnreadCount} unread`
          : "Inbox"
      }
      title="Inbox"
      onClick={onOpen}
    >
      <InboxIcon />
      {inboxUnreadCount > 0 ? (
        <span className="notif-nav-badge" aria-hidden>
          {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
        </span>
      ) : null}
    </button>
  );
}

function NotificationsNavButton({
  open,
  onOpen
}: {
  open: boolean;
  onOpen: () => void;
}) {
  const { unreadCount } = useNotifications();

  return (
    <button
      type="button"
      className={`nav-icon-btn notif-nav-btn${open ? " is-active" : ""}`}
      aria-expanded={open}
      aria-label={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"
      }
      title="Notifications"
      onClick={onOpen}
    >
      <BellIcon />
      {unreadCount > 0 ? (
        <span className="notif-nav-badge" aria-hidden>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function ConnectedInboxDrawer({
  open,
  onClose,
  initialUserId,
  onOpenedTarget
}: {
  open: boolean;
  onClose: () => void;
  initialUserId: string | null;
  onOpenedTarget: () => void;
}) {
  const { setInboxUnreadCount, refreshInboxUnread } = useNotifications();

  return (
    <InboxDrawer
      open={open}
      onClose={() => {
        onClose();
        void refreshInboxUnread();
      }}
      initialUserId={initialUserId}
      onOpenedTarget={onOpenedTarget}
      onUnreadCountChange={setInboxUnreadCount}
    />
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      setIsSignedIn(Boolean(user));
      setAuthReady(true);
    });
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

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
    setNotificationsOpen(false);
    setInboxOpen(true);
  };

  const openNotifications = () => {
    setInboxOpen(false);
    setNotificationsOpen(true);
  };

  const inboxButtonIcon = (
    <InboxNavButton open={inboxOpen} onOpen={openInbox} />
  );

  const notificationButton = (
    <NotificationsNavButton
      open={notificationsOpen}
      onOpen={openNotifications}
    />
  );

  const drawers = (
    <>
      <ConnectedInboxDrawer
        open={inboxOpen}
        onClose={closeInbox}
        initialUserId={activeDmUserId}
        onOpenedTarget={clearDmQuery}
      />
      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </>
  );

  if (variant === "feed") {
    const showAuthedActions = authReady && isSignedIn;
    const showGuestLogin = authReady && !isSignedIn;

    return (
      <NotificationsProvider>
        <header className="landing-nav">
          <Logo />
          <div className="landing-nav-actions">
            <Link className="btn-secondary" href="/rooms">
              Rooms
            </Link>
            {showAuthedActions ? (
              <>
                {inboxButtonIcon}
                {notificationButton}
                <Link className="btn-primary" href="/profile">
                  Profile
                </Link>
              </>
            ) : null}
            {showGuestLogin ? (
              <Link className="btn-primary" href="/login?next=/feed">
                Log in
              </Link>
            ) : null}
          </div>
        </header>
        {showAuthedActions ? drawers : null}
      </NotificationsProvider>
    );
  }

  if (variant === "rooms") {
    const showAuthedActions = authReady && isSignedIn;
    const showGuestLogin = authReady && !isSignedIn;

    return (
      <NotificationsProvider>
        <header className="landing-nav room-select-nav">
          <Logo />
          <div className="landing-nav-actions room-select-nav-actions">
            <Link
              className={
                pathname === "/feed" ? "btn-secondary is-active" : "btn-secondary"
              }
              href="/feed"
            >
              Feed
            </Link>
            {showAuthedActions ? (
              <>
                {inboxButtonIcon}
                {notificationButton}
                <Link className="btn-primary" href="/profile">
                  Profile
                </Link>
              </>
            ) : null}
            {showGuestLogin ? (
              <Link className="btn-primary" href="/login?next=/rooms">
                Log in
              </Link>
            ) : null}
          </div>
        </header>
        {showAuthedActions ? drawers : null}
      </NotificationsProvider>
    );
  }

  if (variant === "profile") {
    const links = [
      { href: "/rooms", label: "Rooms" },
      { href: "/feed", label: "Feed" }
    ] as const;

    return (
      <NotificationsProvider>
        <header className="landing-nav">
          <Logo />
          <nav className="landing-nav-actions profile-nav-pills" aria-label="Main">
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
            {inboxButtonIcon}
            {notificationButton}
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
        {drawers}
      </NotificationsProvider>
    );
  }

  return (
    <header className="landing-nav">
      <Logo />
      <div className="landing-nav-actions">
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
