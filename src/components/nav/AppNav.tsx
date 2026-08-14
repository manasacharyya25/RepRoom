"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { AccountDrawer, type AccountDrawerView } from "@/components/nav/AccountDrawer";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/components/auth/AuthProvider";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { createClient } from "@/lib/supabase/client";
import "@/app/inbox.css";
import "@/app/notifications.css";

async function signOutAndRedirect(router: ReturnType<typeof useRouter>) {
  const supabase = createClient();
  await supabase.auth.signOut();
  await fetch("/api/onboarding/clear-cookie", { method: "POST" }).catch(
    () => null
  );
  router.replace("/login");
  router.refresh();
}

type AppNavProps = {
  /** feed/rooms/profile: Rooms/Feed + People account hub. */
  variant?: "default" | "feed" | "profile" | "rooms";
  /** Open the account hub on Inbox (used by /inbox). */
  defaultInboxOpen?: boolean;
  /** Called when the inbox view of the hub is closed. */
  onInboxClose?: () => void;
};

function RoomsIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="nav-action-icon-img"
      src="/images/icons/rooms.png"
      alt=""
      width={18}
      height={18}
      draggable={false}
    />
  );
}

function FeedIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="nav-action-icon-img"
      src="/images/icons/feed.png"
      alt=""
      width={18}
      height={18}
      draggable={false}
    />
  );
}

function NavActionContent({
  label,
  icon
}: {
  label: string;
  icon: ReactNode;
}) {
  return (
    <>
      <span className="nav-action-label">{label}</span>
      <span className="nav-action-icon" aria-hidden>
        {icon}
      </span>
    </>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M9 11a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 9 11Zm6.5 0a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3.75 18.25c0-2.7 2.15-4.9 4.8-4.9h1.1c1.35 0 2.55.6 3.35 1.5.75-.85 1.85-1.4 3.1-1.4h.7c2.5 0 4.55 2.05 4.55 4.55v.25H3.75v-.25Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleNavButton({
  open,
  onOpen
}: {
  open: boolean;
  onOpen: () => void;
}) {
  const { unreadCount, inboxUnreadCount } = useNotifications();
  const pathname = usePathname();
  const badge = unreadCount + inboxUnreadCount;

  return (
    <button
      type="button"
      className={`nav-icon-btn notif-nav-btn${
        open || pathname === "/inbox" ? " is-active" : ""
      }`}
      aria-expanded={open}
      aria-label={
        badge > 0 ? `Account, ${badge} unread` : "Account"
      }
      title="Account"
      onClick={onOpen}
    >
      <PeopleIcon />
      {badge > 0 ? (
        <span className="notif-nav-badge" aria-hidden>
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
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
  const { authReady, isSignedIn } = useAuth();
  const dmUserId = searchParams.get("dm");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountView, setAccountView] = useState<AccountDrawerView>("menu");
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
    setAccountView("inbox");
    setAccountOpen(true);
  }, [dmUserId]);

  useEffect(() => {
    if (!defaultInboxOpen) return;
    const frame = window.requestAnimationFrame(() => {
      setAccountView("inbox");
      setAccountOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [defaultInboxOpen]);

  const closeAccount = () => {
    setAccountOpen(false);
    setAccountView("menu");
    setActiveDmUserId(null);
    clearDmQuery();
    onInboxClose?.();
  };

  const openAccount = () => {
    setAccountView("menu");
    setAccountOpen(true);
  };

  const peopleButton = (
    <PeopleNavButton open={accountOpen} onOpen={openAccount} />
  );

  const drawers = (
    <AccountDrawer
      open={accountOpen}
      view={accountView}
      onViewChange={setAccountView}
      onClose={closeAccount}
      onSignOut={() => {
        closeAccount();
        void signOutAndRedirect(router);
      }}
      initialUserId={activeDmUserId}
      onOpenedTarget={clearDmQuery}
    />
  );

  const showAuthedActions = authReady && isSignedIn;
  const showGuestLogin = authReady && !isSignedIn;

  if (variant === "feed") {
    return (
      <>
        <header className="landing-nav">
          <Logo />
          <div className="landing-nav-actions">
            <Link
              className="btn-secondary nav-action"
              href="/rooms"
              aria-label="Rooms"
              title="Rooms"
            >
              <NavActionContent label="Rooms" icon={<RoomsIcon />} />
            </Link>
            {showAuthedActions ? peopleButton : null}
            {showGuestLogin ? (
              <Link className="btn-primary" href="/login?next=/feed">
                Log in
              </Link>
            ) : null}
          </div>
        </header>
        {showAuthedActions ? drawers : null}
      </>
    );
  }

  if (variant === "rooms") {
    return (
      <>
        <header className="landing-nav room-select-nav">
          <Logo />
          <div className="landing-nav-actions room-select-nav-actions">
            <Link
              className={`nav-action${
                pathname === "/feed"
                  ? " btn-secondary is-active"
                  : " btn-secondary"
              }`}
              href="/feed"
              aria-label="Feed"
              title="Feed"
            >
              <NavActionContent label="Feed" icon={<FeedIcon />} />
            </Link>
            {showAuthedActions ? peopleButton : null}
            {showGuestLogin ? (
              <Link className="btn-primary" href="/login?next=/rooms">
                Log in
              </Link>
            ) : null}
          </div>
        </header>
        {showAuthedActions ? drawers : null}
      </>
    );
  }

  if (variant === "profile") {
    const links = [
      { href: "/rooms", label: "Rooms", icon: <RoomsIcon /> },
      { href: "/feed", label: "Feed", icon: <FeedIcon /> }
    ] as const;

    return (
      <>
        <header className="landing-nav">
          <Logo />
          <nav className="landing-nav-actions profile-nav-pills" aria-label="Main">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-action${
                    isActive ? " btn-secondary is-active" : " btn-secondary"
                  }`}
                  aria-label={link.label}
                  title={link.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <NavActionContent label={link.label} icon={link.icon} />
                </Link>
              );
            })}
            {peopleButton}
          </nav>
        </header>
        {drawers}
      </>
    );
  }

  return (
    <>
      <header className="landing-nav">
        <Logo />
        <div className="landing-nav-actions">
          {showAuthedActions ? peopleButton : null}
          {showGuestLogin ? (
            <Link className="btn-primary" href="/login">
              Log in
            </Link>
          ) : null}
        </div>
      </header>
      {showAuthedActions ? drawers : null}
    </>
  );
}

export function AppNav(props: AppNavProps) {
  return (
    <Suspense fallback={<header className="landing-nav" aria-hidden />}>
      <AppNavInner {...props} />
    </Suspense>
  );
}
