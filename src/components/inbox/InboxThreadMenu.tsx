"use client";

import { useEffect, useRef, useState } from "react";
import type { InboxThreadView } from "@/lib/types/messaging";

type InboxThreadMenuProps = {
  thread: InboxThreadView;
  busy?: boolean;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onBlock: () => void;
  onDelete: () => void;
};

export function InboxThreadMenu({
  thread,
  busy = false,
  onMarkRead,
  onMarkUnread,
  onBlock,
  onDelete
}: InboxThreadMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="inbox-thread-menu" ref={menuRef}>
      <button
        type="button"
        className="inbox-thread-menu-trigger"
        aria-label={`Options for conversation with ${thread.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <span aria-hidden>⋮</span>
      </button>
      {open ? (
        <div className="inbox-thread-menu-dropdown" role="menu">
          {thread.unread ? (
            <button
              type="button"
              role="menuitem"
              className="inbox-thread-menu-item"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onMarkRead();
              }}
            >
              Mark as read
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="inbox-thread-menu-item"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onMarkUnread();
              }}
            >
              Mark as unread
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="inbox-thread-menu-item"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onBlock();
            }}
          >
            Block user
          </button>
          <button
            type="button"
            role="menuitem"
            className="inbox-thread-menu-item inbox-thread-menu-item--danger"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onDelete();
            }}
          >
            Delete message
          </button>
        </div>
      ) : null}
    </div>
  );
}
