"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import "@/app/notifications.css";

type NotificationsDrawerProps = {
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
  onBack?: () => void;
};

function isRemoteSrc(src: string) {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("blob:")
  );
}

function typeLabel(type: string) {
  switch (type) {
    case "follow":
      return "Follow";
    case "like":
      return "Like";
    case "comment":
      return "Comment";
    case "message":
      return "Message";
    default:
      return "Update";
  }
}

export function NotificationsDrawer({
  open,
  onClose,
  embedded = false,
  onBack
}: NotificationsDrawerProps) {
  const router = useRouter();
  const { items, loading, unreadCount, markRead, markAllRead, refresh } =
    useNotifications();

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (embedded && onBack) {
        onBack();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    if (embedded) {
      return () => {
        window.removeEventListener("keydown", onKeyDown);
      };
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, onBack, embedded]);

  return (
    <div
      className={`notif-drawer-root${open ? " is-open" : ""}${
        embedded ? " notif-drawer-root--embedded" : ""
      }`}
      aria-hidden={!open}
    >
      {embedded ? null : (
        <button
          type="button"
          className="notif-drawer-backdrop"
          aria-label="Close notifications"
          tabIndex={open ? 0 : -1}
          onClick={onClose}
        />
      )}

      <aside
        className="notif-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
      >
        <header className="notif-drawer-header">
          {embedded && onBack ? (
            <button
              type="button"
              className="notif-drawer-close"
              aria-label="Back"
              onClick={onBack}
            >
              ←
            </button>
          ) : null}
          <div className="notif-drawer-title">
            <strong>Notifications</strong>
            <span>
              {loading
                ? "Loading…"
                : unreadCount > 0
                  ? `${unreadCount} unread`
                  : `${items.length} total`}
            </span>
          </div>
          <div className="notif-drawer-header-actions">
            {unreadCount > 0 ? (
              <button
                type="button"
                className="notif-mark-all"
                onClick={() => {
                  void markAllRead();
                }}
              >
                Mark all read
              </button>
            ) : null}
            <button
              type="button"
              className="notif-drawer-close"
              aria-label="Close notifications"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        {!loading && items.length === 0 ? (
          <p className="notif-empty">
            No notifications yet. Follows, likes, comments, and messages will
            show up here.
          </p>
        ) : null}

        <ul className="notif-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`notif-row${item.read ? "" : " is-unread"}`}
                onClick={() => {
                  void markRead(item.id);
                  onClose();
                  if (item.href) {
                    router.push(item.href);
                  }
                }}
              >
                <span className="notif-avatar">
                  <Image
                    alt=""
                    className="notif-avatar-image"
                    fill
                    sizes="44px"
                    src={item.actorAvatar}
                    unoptimized={isRemoteSrc(item.actorAvatar)}
                  />
                </span>
                <span className="notif-row-copy">
                  <span className="notif-row-top">
                    <span className="notif-kind">{typeLabel(item.type)}</span>
                    <time>{item.timeLabel}</time>
                  </span>
                  <p className="notif-row-title">{item.title}</p>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
