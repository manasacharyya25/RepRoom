import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_IMAGES } from "@/lib/live-images";
import type {
  DbNotification,
  NotificationActor,
  NotificationType,
  NotificationView
} from "@/lib/types/notification";

type NotificationPost = {
  id: string;
  caption: string | null;
};

function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) return `${Math.max(1, Math.round(diffSec / 60))}m`;
  if (diffSec < 86400) return `${Math.max(1, Math.round(diffSec / 3600))}h`;
  if (diffSec < 86400 * 7) {
    return `${Math.max(1, Math.round(diffSec / 86400))}d`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function clip(text: string, max = 100) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function actorLabel(actor: NotificationActor | null | undefined) {
  const name = actor?.display_name?.trim() || "Someone";
  const username = actor?.username?.trim() || null;
  const handle = username ? `@${username}` : "@athlete";
  const avatar = actor?.avatar_url?.trim() || LIVE_IMAGES.participant4;
  const profileHref = username ? `/u/${encodeURIComponent(username)}` : null;
  return { name, handle, avatar, profileHref, username };
}

function postLabel(post: NotificationPost | null | undefined) {
  const caption = post?.caption?.trim();
  if (!caption) return "your post";
  return `your post “${clip(caption, 72)}”`;
}

function titleFor(
  type: NotificationType,
  actorName: string,
  preview: string | null,
  post: NotificationPost | null | undefined
) {
  const postText = postLabel(post);
  switch (type) {
    case "follow":
      return `${actorName} followed you`;
    case "like":
      return `${actorName} liked ${postText}`;
    case "comment": {
      const comment = preview?.trim();
      if (comment) {
        return `${actorName} commented “${clip(comment, 80)}” on ${postText}`;
      }
      return `${actorName} commented on ${postText}`;
    }
    case "message": {
      const body = preview?.trim();
      if (body) {
        return `${actorName} sent you a message: “${clip(body, 100)}”`;
      }
      return `${actorName} sent you a message`;
    }
    default:
      return `${actorName} notified you`;
  }
}

function hrefFor(
  type: NotificationType,
  actor: ReturnType<typeof actorLabel>,
  row: DbNotification
): string | null {
  switch (type) {
    case "follow":
      return actor.profileHref;
    case "like":
    case "comment":
      return "/feed";
    case "message":
      return `/inbox?dm=${encodeURIComponent(row.actor_id)}`;
    default:
      return null;
  }
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function mapNotificationRow(
  row: DbNotification,
  actorRaw: NotificationActor | NotificationActor[] | null | undefined,
  postRaw?: NotificationPost | NotificationPost[] | null
): NotificationView {
  const actor = actorLabel(unwrapOne(actorRaw));
  const post = unwrapOne(postRaw);
  return {
    id: row.id,
    type: row.type,
    actorId: row.actor_id,
    actorName: actor.name,
    actorHandle: actor.handle,
    actorAvatar: actor.avatar,
    actorProfileHref: actor.profileHref,
    preview: row.preview,
    postId: row.post_id,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    timeLabel: formatRelativeTime(row.created_at),
    read: Boolean(row.read_at),
    title: titleFor(row.type, actor.name, row.preview, post),
    href: hrefFor(row.type, actor, row)
  };
}

const NOTIFICATION_SELECT = `
  id,
  recipient_id,
  actor_id,
  type,
  post_id,
  comment_id,
  conversation_id,
  message_id,
  preview,
  read_at,
  created_at,
  profiles!notifications_actor_id_fkey (
    id,
    display_name,
    username,
    avatar_url
  ),
  posts!notifications_post_id_fkey (
    id,
    caption
  )
`;

type NotificationQueryRow = DbNotification & {
  profiles: NotificationActor | NotificationActor[] | null;
  posts: NotificationPost | NotificationPost[] | null;
};

function mapQueryRow(row: NotificationQueryRow): NotificationView {
  const { profiles, posts, ...notification } = row;
  return mapNotificationRow(notification, profiles, posts);
}

export async function listNotifications(
  supabase: SupabaseClient,
  limit = 40
): Promise<NotificationView[]> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("recipient_id", user.id)
    .neq("type", "message")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => mapQueryRow(row as NotificationQueryRow));
}

export async function countUnreadNotifications(
  supabase: SupabaseClient
): Promise<number> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .neq("type", "message")
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  notificationId: string
): Promise<void> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) throw error;
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient
): Promise<void> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .neq("type", "message")
    .is("read_at", null);

  if (error) throw error;
}

export async function fetchNotificationView(
  supabase: SupabaseClient,
  notificationId: string
): Promise<NotificationView | null> {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("id", notificationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapQueryRow(data as NotificationQueryRow);
}
