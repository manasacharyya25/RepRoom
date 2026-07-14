export type NotificationType = "follow" | "like" | "comment" | "message";

export type DbNotification = {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  preview: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationActor = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type NotificationView = {
  id: string;
  type: NotificationType;
  actorId: string;
  actorName: string;
  actorHandle: string;
  actorAvatar: string;
  actorProfileHref: string | null;
  preview: string | null;
  postId: string | null;
  conversationId: string | null;
  createdAt: string;
  timeLabel: string;
  read: boolean;
  title: string;
  href: string | null;
};
