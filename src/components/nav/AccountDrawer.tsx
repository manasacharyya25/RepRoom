"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { InboxDrawer } from "@/components/inbox/InboxDrawer";
import { NotificationsDrawer } from "@/components/notifications/NotificationsDrawer";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { ReferralsPanel } from "@/components/referrals/ReferralsPanel";
import "@/app/account.css";
import "@/app/referrals.css";

export type AccountDrawerView = "menu" | "notifications" | "inbox" | "referrals";

type AccountDrawerProps = {
  open: boolean;
  view: AccountDrawerView;
  onViewChange: (view: AccountDrawerView) => void;
  onClose: () => void;
  onSignOut: () => void;
  initialUserId: string | null;
  onOpenedTarget: () => void;
};

function ProfileMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M12 12.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M6.5 18.25a5.5 5.5 0 0 1 11 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellMenuIcon() {
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

function InboxMenuIcon() {
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

function ReferralsMenuIcon() {
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

function LogoutMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M10.25 5.75H7.75A2 2 0 0 0 5.75 7.75v8.5a2 2 0 0 0 2 2h2.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M10.75 12h7.5M15.5 8.75 18.75 12 15.5 15.25"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AccountDrawer({
  open,
  view,
  onViewChange,
  onClose,
  onSignOut,
  initialUserId,
  onOpenedTarget
}: AccountDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { unreadCount, inboxUnreadCount, setInboxUnreadCount, refreshInboxUnread } =
    useNotifications();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && view === "menu") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, view, onClose]);

  const goMenu = () => onViewChange("menu");

  return (
    <div
      className={`account-drawer-root${open ? " is-open" : ""}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="account-drawer-backdrop"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <aside
        className="account-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={
          view === "menu"
            ? "Account"
            : view === "notifications"
              ? "Notifications"
              : view === "inbox"
                ? "Inbox"
                : "Referrals"
        }
      >
        {view === "menu" ? (
          <div className="account-panel">
            <header className="notif-drawer-header">
              <div className="notif-drawer-title">
                <strong>Account</strong>
                <span>Profile, inbox, and invites</span>
              </div>
              <button
                type="button"
                className="notif-drawer-close"
                aria-label="Close menu"
                onClick={onClose}
              >
                ×
              </button>
            </header>

            <nav className="account-menu" aria-label="Account">
              <button
                type="button"
                className="account-menu-row"
                onClick={() => {
                  onClose();
                  if (pathname !== "/profile") {
                    router.push("/profile");
                  }
                }}
              >
                <span className="account-menu-icon" aria-hidden>
                  <ProfileMenuIcon />
                </span>
                <span className="account-menu-copy">
                  <strong>Profile</strong>
                  <span>Your page and workout log</span>
                </span>
              </button>

              <button
                type="button"
                className="account-menu-row"
                onClick={() => onViewChange("notifications")}
              >
                <span className="account-menu-icon" aria-hidden>
                  <BellMenuIcon />
                </span>
                <span className="account-menu-copy">
                  <strong>Notifications</strong>
                  <span>
                    {unreadCount > 0
                      ? `${unreadCount} unread`
                      : "Follows, likes, and comments"}
                  </span>
                </span>
                {unreadCount > 0 ? (
                  <span className="account-menu-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                className="account-menu-row"
                onClick={() => onViewChange("inbox")}
              >
                <span className="account-menu-icon" aria-hidden>
                  <InboxMenuIcon />
                </span>
                <span className="account-menu-copy">
                  <strong>Inbox</strong>
                  <span>
                    {inboxUnreadCount > 0
                      ? `${inboxUnreadCount} unread`
                      : "Direct messages"}
                  </span>
                </span>
                {inboxUnreadCount > 0 ? (
                  <span className="account-menu-badge">
                    {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                className="account-menu-row"
                onClick={() => onViewChange("referrals")}
              >
                <span className="account-menu-icon" aria-hidden>
                  <ReferralsMenuIcon />
                </span>
                <span className="account-menu-copy">
                  <strong>Referrals</strong>
                  <span>Invites and revenue sharing</span>
                </span>
              </button>

              <button
                type="button"
                className="account-menu-row account-menu-row--logout"
                onClick={onSignOut}
              >
                <span className="account-menu-icon" aria-hidden>
                  <LogoutMenuIcon />
                </span>
                <span className="account-menu-copy">
                  <strong>Log out</strong>
                  <span>Sign out of this device</span>
                </span>
              </button>
            </nav>
          </div>
        ) : null}

        {view === "notifications" ? (
          <NotificationsDrawer
            open={open}
            embedded
            onBack={goMenu}
            onClose={onClose}
          />
        ) : null}

        {view === "inbox" ? (
          <InboxDrawer
            open={open}
            embedded
            onBack={goMenu}
            onClose={() => {
              onClose();
              void refreshInboxUnread();
            }}
            initialUserId={initialUserId}
            onOpenedTarget={onOpenedTarget}
            onUnreadCountChange={setInboxUnreadCount}
          />
        ) : null}

        {view === "referrals" ? (
          <ReferralsPanel onBack={goMenu} onClose={onClose} />
        ) : null}
      </aside>
    </div>
  );
}
