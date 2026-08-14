"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LIVE_IMAGES } from "@/lib/live-images";
import { createClient } from "@/lib/supabase/client";
import {
  blockUser,
  deleteConversation,
  getOrCreateDm,
  listConversations,
  listMessages,
  mapDbMessageToView,
  markConversationRead,
  markConversationUnread,
  sendMessage as sendMessageApi
} from "@/lib/social-api";
import type {
  DbMessage,
  InboxMessageView,
  InboxThreadView
} from "@/lib/types/messaging";
import { InboxThreadMenu } from "@/components/inbox/InboxThreadMenu";

type InboxDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Open this conversation once loaded. */
  initialConversationId?: string | null;
  /** Resolve/create a DM with this user, then open it. */
  initialUserId?: string | null;
  onOpenedTarget?: () => void;
  /** Report unread conversation count to the nav badge. */
  onUnreadCountChange?: (count: number) => void;
  /** Render inside another drawer (no overlay). */
  embedded?: boolean;
  onBack?: () => void;
};

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function isRemoteSrc(src: string) {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("blob:")
  );
}

export function InboxDrawer({
  open,
  onClose,
  initialConversationId = null,
  initialUserId = null,
  onOpenedTarget,
  onUnreadCountChange,
  embedded = false,
  onBack
}: InboxDrawerProps) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [threads, setThreads] = useState<InboxThreadView[]>([]);
  const [messages, setMessages] = useState<InboxMessageView[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewerAvatar, setViewerAvatar] = useState(LIVE_IMAGES.participant4);
  const [menuBusyId, setMenuBusyId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handledTargetRef = useRef<string | null>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const refreshThreads = useCallback(async () => {
    const supabase = createClient();
    const page = await listConversations(supabase);
    setThreads(page);
    return page;
  }, []);

  useEffect(() => {
    if (!open) return;
    onUnreadCountChange?.(
      threads.reduce((total, thread) => total + (thread.unread ? 1 : 0), 0)
    );
  }, [threads, open, onUnreadCountChange]);

  useEffect(() => {
    if (!open) {
      setActiveThreadId(null);
      setDraft("");
      setMessages([]);
      setError(null);
      handledTargetRef.current = null;
      return;
    }

    let cancelled = false;

    const boot = async () => {
      setLoadingList(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Sign in to use inbox.");
        if (cancelled) return;
        setCurrentUserId(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        if (!cancelled && profile?.avatar_url) {
          setViewerAvatar(profile.avatar_url);
        }

        await refreshThreads();
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load inbox."
          );
          setThreads([]);
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [open, refreshThreads]);

  useEffect(() => {
    if (!open) return;

    const targetKey = `${initialConversationId ?? ""}:${initialUserId ?? ""}`;
    if (!initialConversationId && !initialUserId) return;
    if (handledTargetRef.current === targetKey) return;

    let cancelled = false;

    const openTarget = async () => {
      try {
        const supabase = createClient();
        let conversationId = initialConversationId;

        if (!conversationId && initialUserId) {
          conversationId = await getOrCreateDm(supabase, initialUserId);
        }
        if (!conversationId || cancelled) return;

        const list = await refreshThreads();
        if (cancelled) return;

        if (!list.some((thread) => thread.id === conversationId)) {
          await refreshThreads();
        }

        setActiveThreadId(conversationId);
        handledTargetRef.current = targetKey;
        onOpenedTarget?.();
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not open conversation."
          );
        }
      }
    };

    void openTarget();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    initialConversationId,
    initialUserId,
    onOpenedTarget,
    refreshThreads
  ]);

  useEffect(() => {
    if (!open || !activeThreadId || !currentUserId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const load = async () => {
      setLoadingThread(true);
      setError(null);
      try {
        const rows = await listMessages(supabase, activeThreadId);
        if (cancelled) return;
        setMessages(rows);
        await markConversationRead(supabase, activeThreadId);
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === activeThreadId
              ? { ...thread, unread: false }
              : thread
          )
        );
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load messages."
          );
        }
      } finally {
        if (!cancelled) setLoadingThread(false);
      }
    };

    void load();

    const channel = supabase
      .channel(`dm:${activeThreadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeThreadId}`
        },
        (payload) => {
          const row = payload.new as DbMessage;
          const view = mapDbMessageToView(row, currentUserId);
          setMessages((prev) => {
            if (prev.some((message) => message.id === view.id)) return prev;
            return [...prev, view];
          });
          setThreads((prev) =>
            prev.map((thread) =>
              thread.id === activeThreadId
                ? {
                    ...thread,
                    preview: view.body,
                    time: "Just now",
                    unread: view.from === "them" ? false : thread.unread,
                    updatedAt: view.createdAt
                  }
                : thread
            )
          );
          if (view.from === "them") {
            void markConversationRead(supabase, activeThreadId);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [open, activeThreadId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeThreadId]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activeThreadId) {
        setActiveThreadId(null);
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
  }, [open, onClose, onBack, embedded, activeThreadId]);

  const runThreadAction = async (
    thread: InboxThreadView,
    action: "read" | "unread" | "block" | "delete"
  ) => {
    if (menuBusyId) return;
    setMenuBusyId(thread.id);
    setError(null);
    try {
      const supabase = createClient();
      if (action === "read") {
        await markConversationRead(supabase, thread.id);
        setThreads((prev) =>
          prev.map((item) =>
            item.id === thread.id ? { ...item, unread: false } : item
          )
        );
      } else if (action === "unread") {
        await markConversationUnread(supabase, thread.id);
        setThreads((prev) =>
          prev.map((item) =>
            item.id === thread.id ? { ...item, unread: true } : item
          )
        );
      } else if (action === "block") {
        await blockUser(supabase, thread.otherUserId);
        setThreads((prev) => prev.filter((item) => item.id !== thread.id));
        if (activeThreadId === thread.id) {
          setActiveThreadId(null);
          setMessages([]);
        }
      } else {
        await deleteConversation(supabase, thread.id);
        setThreads((prev) => prev.filter((item) => item.id !== thread.id));
        if (activeThreadId === thread.id) {
          setActiveThreadId(null);
          setMessages([]);
        }
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update conversation."
      );
    } finally {
      setMenuBusyId(null);
    }
  };

  const sendMessage = async (thread: InboxThreadView) => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const supabase = createClient();
      const created = await sendMessageApi(supabase, thread.id, text);
      setMessages((prev) => {
        if (prev.some((message) => message.id === created.id)) return prev;
        return [...prev, created];
      });
      setThreads((prev) => {
        const next = prev.map((item) =>
          item.id === thread.id
            ? {
                ...item,
                preview: created.body,
                time: "Just now",
                unread: false,
                updatedAt: created.createdAt
              }
            : item
        );
        return next.sort((a, b) =>
          a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0
        );
      });
      setDraft("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not send message."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`inbox-drawer-root${open ? " is-open" : ""}${
        embedded ? " inbox-drawer-root--embedded" : ""
      }`}
      aria-hidden={!open}
    >
      {embedded ? null : (
        <button
          type="button"
          className="inbox-drawer-backdrop"
          aria-label="Close inbox"
          tabIndex={open ? 0 : -1}
          onClick={onClose}
        />
      )}

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
                    unoptimized={isRemoteSrc(activeThread.avatar)}
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
              {loadingThread ? (
                <p className="inbox-empty-copy">Loading messages…</p>
              ) : null}
              {!loadingThread && messages.length === 0 ? (
                <p className="inbox-empty-copy">
                  No messages yet. Say hello.
                </p>
              ) : null}
              {messages.map((message) => (
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
                        unoptimized={isRemoteSrc(activeThread.avatar)}
                      />
                    </span>
                  ) : null}
                  <div className="inbox-bubble-body">
                    <p>{message.body}</p>
                    <time>{formatMessageTime(message.createdAt)}</time>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {error ? <p className="inbox-error">{error}</p> : null}

            <form
              className="inbox-thread-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(activeThread);
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
                disabled={sending}
                maxLength={2000}
              />
              <button type="submit" disabled={!draft.trim() || sending}>
                {sending ? "…" : "Send"}
              </button>
            </form>
          </div>
        ) : (
          <div className="inbox-list">
            <header className="inbox-drawer-header">
              {embedded && onBack ? (
                <button
                  type="button"
                  className="inbox-drawer-back"
                  aria-label="Back"
                  onClick={onBack}
                >
                  ←
                </button>
              ) : null}
              <div className="inbox-drawer-title">
                <strong>Inbox</strong>
                <span>
                  {loadingList
                    ? "Loading…"
                    : `${threads.length} conversation${
                        threads.length === 1 ? "" : "s"
                      }`}
                </span>
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

            {error ? <p className="inbox-error">{error}</p> : null}

            {!loadingList && threads.length === 0 ? (
              <p className="inbox-empty-copy">
                No conversations yet. Message someone from their profile.
              </p>
            ) : null}

            <ul className="inbox-message-list">
              {threads.map((thread) => (
                <li key={thread.id} className="inbox-message-item">
                  <button
                    type="button"
                    className={`inbox-message-row${
                      thread.unread ? " is-unread" : ""
                    }`}
                    onClick={() => setActiveThreadId(thread.id)}
                  >
                    <span className="inbox-avatar">
                      <Image
                        alt=""
                        className="inbox-avatar-image"
                        fill
                        sizes="48px"
                        src={thread.avatar}
                        unoptimized={isRemoteSrc(thread.avatar)}
                      />
                    </span>
                    <span className="inbox-message-copy">
                      <span className="inbox-message-top">
                        <strong>{thread.name}</strong>
                      </span>
                      <span className="inbox-message-preview">
                        {thread.preview}
                      </span>
                    </span>
                    <span className="inbox-message-meta">
                      <time>{thread.time}</time>
                    </span>
                  </button>
                  <InboxThreadMenu
                    thread={thread}
                    busy={menuBusyId === thread.id}
                    onMarkRead={() => {
                      void runThreadAction(thread, "read");
                    }}
                    onMarkUnread={() => {
                      void runThreadAction(thread, "unread");
                    }}
                    onBlock={() => {
                      void runThreadAction(thread, "block");
                    }}
                    onDelete={() => {
                      void runThreadAction(thread, "delete");
                    }}
                  />
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
                  src={viewerAvatar}
                  unoptimized={isRemoteSrc(viewerAvatar)}
                />
              </span>
              <p>Direct messages with people you follow and chat with.</p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
