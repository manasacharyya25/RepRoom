"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  countUnreadNotifications,
  fetchNotificationView,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "@/lib/notifications-api";
import { countUnreadConversations } from "@/lib/social-api";
import { createClient } from "@/lib/supabase/client";
import type { NotificationView } from "@/lib/types/notification";
import "@/app/notifications.css";

type NotificationsContextValue = {
  unreadCount: number;
  inboxUnreadCount: number;
  items: NotificationView[];
  loading: boolean;
  refresh: () => Promise<void>;
  refreshInboxUnread: () => Promise<void>;
  setInboxUnreadCount: (count: number) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return value;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const refreshInboxUnread = useCallback(async () => {
    const supabase = createClient();
    try {
      const count = await countUnreadConversations(supabase);
      setInboxUnreadCount(count);
    } catch {
      // Inbox tables may not be migrated yet.
    }
  }, []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [list, unread] = await Promise.all([
      listNotifications(supabase),
      countUnreadNotifications(supabase)
    ]);
    setItems(list);
    setUnreadCount(unread);
    await refreshInboxUnread();
  }, [refreshInboxUnread]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setUserId(null);
          setItems([]);
          setUnreadCount(0);
          setInboxUnreadCount(0);
          return;
        }
        setUserId(user.id);
        await refresh();
      } catch {
        if (!cancelled) {
          setItems([]);
          setUnreadCount(0);
          setInboxUnreadCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          const row = payload.new as { id?: string; type?: string };
          if (!row.id) return;

          if (row.type === "message") {
            void refreshInboxUnread();
            return;
          }

          void (async () => {
            try {
              const view = await fetchNotificationView(supabase, row.id!);
              if (!view || view.type === "message") return;
              setItems((prev) => {
                if (prev.some((item) => item.id === view.id)) return prev;
                return [view, ...prev];
              });
              setUnreadCount((count) => count + (view.read ? 0 : 1));
            } catch {
              // List refresh on open can recover.
            }
          })();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshInboxUnread]);

  const markRead = useCallback(async (id: string) => {
    let shouldDecrement = false;
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      shouldDecrement = Boolean(target && !target.read);
      return prev.map((item) =>
        item.id === id ? { ...item, read: true } : item
      );
    });
    if (shouldDecrement) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    const supabase = createClient();
    await markNotificationRead(supabase, id);
  }, []);

  const markAllRead = useCallback(async () => {
    const supabase = createClient();
    await markAllNotificationsRead(supabase);
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({
      unreadCount,
      inboxUnreadCount,
      items,
      loading,
      refresh,
      refreshInboxUnread,
      setInboxUnreadCount,
      markRead,
      markAllRead
    }),
    [
      unreadCount,
      inboxUnreadCount,
      items,
      loading,
      refresh,
      refreshInboxUnread,
      markRead,
      markAllRead
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
