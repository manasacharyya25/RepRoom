"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { INBOX_THREADS, type InboxThread } from "@/lib/inbox";
import { LIVE_IMAGES } from "@/lib/live-images";

type InboxDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function InboxDrawer({ open, onClose }: InboxDrawerProps) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [threads, setThreads] = useState(INBOX_THREADS);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  useEffect(() => {
    if (!open) {
      setActiveThreadId(null);
      setDraft("");
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activeThreadId) {
        setActiveThreadId(null);
        return;
      }
      onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, activeThreadId]);

  const sendMessage = (thread: InboxThread) => {
    const text = draft.trim();
    if (!text) return;

    setThreads((prev) =>
      prev.map((item) => {
        if (item.id !== thread.id) return item;
        return {
          ...item,
          preview: text,
          time: "Just now",
          unread: false,
          messages: [
            ...item.messages,
            {
              id: `${item.id}-${Date.now()}`,
              from: "you" as const,
              text,
              time: "Just now"
            }
          ]
        };
      })
    );
    setDraft("");
  };

  return (
    <div
      className={`inbox-drawer-root${open ? " is-open" : ""}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="inbox-drawer-backdrop"
        aria-label="Close inbox"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <aside
        className="inbox-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Inbox"
      >
        {activeThread ? (
          <div className="inbox-thread">
            <header className="inbox-drawer-header">
              <button
                type="button"
                className="inbox-drawer-back"
                onClick={() => setActiveThreadId(null)}
              >
                ←
              </button>
              <div className="inbox-thread-person">
                <span className="inbox-avatar">
                  <Image
                    alt=""
                    className="inbox-avatar-image"
                    fill
                    sizes="40px"
                    src={activeThread.avatar}
                  />
                </span>
                <div>
                  <strong>{activeThread.name}</strong>
                  <span>{activeThread.handle}</span>
                </div>
              </div>
              <button
                type="button"
                className="inbox-drawer-close"
                aria-label="Close inbox"
                onClick={onClose}
              >
                ×
              </button>
            </header>

            <div className="inbox-thread-messages">
              {activeThread.messages.map((message) => (
                <div
                  key={message.id}
                  className={`inbox-bubble${
                    message.from === "you" ? " is-you" : " is-them"
                  }`}
                >
                  {message.from === "them" ? (
                    <span className="inbox-bubble-avatar">
                      <Image
                        alt=""
                        className="inbox-avatar-image"
                        fill
                        sizes="28px"
                        src={activeThread.avatar}
                      />
                    </span>
                  ) : null}
                  <div className="inbox-bubble-body">
                    <p>{message.text}</p>
                    <time>{message.time}</time>
                  </div>
                </div>
              ))}
            </div>

            <form
              className="inbox-thread-composer"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage(activeThread);
              }}
            >
              <label className="sr-only" htmlFor="inbox-reply">
                Write a message
              </label>
              <input
                id="inbox-reply"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message…"
              />
              <button type="submit" disabled={!draft.trim()}>
                Send
              </button>
            </form>
          </div>
        ) : (
          <div className="inbox-list">
            <header className="inbox-drawer-header">
              <div className="inbox-drawer-title">
                <strong>Inbox</strong>
                <span>{threads.length} conversations</span>
              </div>
              <button
                type="button"
                className="inbox-drawer-close"
                aria-label="Close inbox"
                onClick={onClose}
              >
                ×
              </button>
            </header>

            <ul className="inbox-message-list">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    className={`inbox-message-row${
                      thread.unread ? " is-unread" : ""
                    }`}
                    onClick={() => {
                      setActiveThreadId(thread.id);
                      setThreads((prev) =>
                        prev.map((item) =>
                          item.id === thread.id
                            ? { ...item, unread: false }
                            : item
                        )
                      );
                    }}
                  >
                    <span className="inbox-avatar">
                      <Image
                        alt=""
                        className="inbox-avatar-image"
                        fill
                        sizes="48px"
                        src={thread.avatar}
                      />
                    </span>
                    <span className="inbox-message-copy">
                      <span className="inbox-message-top">
                        <strong>{thread.name}</strong>
                        <time>{thread.time}</time>
                      </span>
                      <span className="inbox-message-preview">
                        {thread.preview}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="inbox-list-footer">
              <span className="inbox-avatar inbox-avatar--you">
                <Image
                  alt=""
                  className="inbox-avatar-image"
                  fill
                  sizes="28px"
                  src={LIVE_IMAGES.participant4}
                />
              </span>
              <p>Messages from rooms & buddies show up here.</p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
