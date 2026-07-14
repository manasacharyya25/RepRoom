export type ConversationMemberProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type DbMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type InboxMessageView = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  from: "you" | "them";
};

export type InboxThreadView = {
  id: string;
  otherUserId: string;
  name: string;
  handle: string;
  avatar: string;
  preview: string;
  time: string;
  updatedAt: string;
  unread: boolean;
};

export const MESSAGE_MAX_LENGTH = 2000;
