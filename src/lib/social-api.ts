import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_IMAGES } from "@/lib/live-images";
import type {
  ConversationMemberProfile,
  DbMessage,
  InboxMessageView,
  InboxThreadView
} from "@/lib/types/messaging";
import { MESSAGE_MAX_LENGTH } from "@/lib/types/messaging";

function requireUser(user: { id: string } | null) {
  if (!user) throw new Error("Sign in to continue.");
  return user;
}

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

function profileLabel(profile: ConversationMemberProfile | null | undefined) {
  const name = profile?.display_name?.trim() || "Athlete";
  const username = profile?.username?.trim() || null;
  const handle = username ? `@${username}` : "@athlete";
  const avatar = profile?.avatar_url?.trim() || LIVE_IMAGES.participant4;
  return { name, handle, avatar, username };
}

export async function isFollowing(
  supabase: SupabaseClient,
  followingId: string
): Promise<boolean> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function followUser(
  supabase: SupabaseClient,
  followingId: string
): Promise<void> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  const me = requireUser(user);
  if (me.id === followingId) throw new Error("You cannot follow yourself.");

  const { error } = await supabase.from("follows").insert({
    follower_id: me.id,
    following_id: followingId
  });
  if (error) throw error;
}

export async function unfollowUser(
  supabase: SupabaseClient,
  followingId: string
): Promise<void> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  const me = requireUser(user);

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", me.id)
    .eq("following_id", followingId);
  if (error) throw error;
}

export async function getOrCreateDm(
  supabase: SupabaseClient,
  otherUserId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_dm", {
    other_user_id: otherUserId
  });
  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("Could not open conversation.");
  }
  return data;
}

export async function listConversations(
  supabase: SupabaseClient
): Promise<InboxThreadView[]> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  const me = requireUser(user);

  const { data: memberships, error: memberError } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", me.id);

  if (memberError) throw memberError;
  if (!memberships?.length) return [];

  const conversationIds = memberships.map((row) => row.conversation_id);
  const lastReadByConversation = new Map(
    memberships.map((row) => [row.conversation_id as string, row.last_read_at as string | null])
  );

  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id, updated_at")
    .in("id", conversationIds)
    .order("updated_at", { ascending: false });

  if (convError) throw convError;
  if (!conversations?.length) return [];

  const { data: members, error: othersError } = await supabase
    .from("conversation_members")
    .select(
      `
      conversation_id,
      user_id,
      profiles!conversation_members_user_id_fkey (
        id,
        display_name,
        username,
        avatar_url
      )
    `
    )
    .in("conversation_id", conversationIds)
    .neq("user_id", me.id);

  if (othersError) throw othersError;

  const otherByConversation = new Map<string, ConversationMemberProfile>();
  for (const row of members ?? []) {
    const profileRaw = row.profiles as
      | ConversationMemberProfile
      | ConversationMemberProfile[]
      | null;
    const profile = Array.isArray(profileRaw)
      ? profileRaw[0] ?? null
      : profileRaw;
    if (profile) {
      otherByConversation.set(row.conversation_id as string, {
        id: profile.id,
        display_name: profile.display_name,
        username: profile.username,
        avatar_url: profile.avatar_url
      });
    }
  }

  const { data: lastMessageRows, error: msgError } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  if (msgError) throw msgError;

  const lastByConversation = new Map<string, DbMessage>();
  for (const row of (lastMessageRows ?? []) as DbMessage[]) {
    if (!lastByConversation.has(row.conversation_id)) {
      lastByConversation.set(row.conversation_id, row);
    }
  }

  const threads: InboxThreadView[] = [];

  for (const conversation of conversations) {
    const other = otherByConversation.get(conversation.id);
    if (!other) continue;

    const last = lastByConversation.get(conversation.id) ?? null;
    const labels = profileLabel(other);
    const lastReadAt = lastReadByConversation.get(conversation.id);
    const unread = Boolean(
      last &&
        last.sender_id !== me.id &&
        (!lastReadAt || new Date(last.created_at) > new Date(lastReadAt))
    );

    threads.push({
      id: conversation.id,
      otherUserId: other.id,
      name: labels.name,
      handle: labels.handle,
      avatar: labels.avatar,
      preview: last?.body ?? "Say hello",
      time: formatRelativeTime(last?.created_at ?? conversation.updated_at),
      updatedAt: conversation.updated_at,
      unread
    });
  }

  return threads;
}

export async function listMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<InboxMessageView[]> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  const me = requireUser(user);

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as DbMessage[]).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    from: row.sender_id === me.id ? "you" : "them"
  }));
}

export async function sendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  body: string
): Promise<InboxMessageView> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    throw new Error("Message is too long.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  const me = requireUser(user);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: me.id,
      body: trimmed
    })
    .select("*")
    .single();

  if (error) throw error;
  const row = data as DbMessage;

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    from: "you"
  };
}

export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  const me = requireUser(user);

  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", me.id);

  if (error) throw error;
}

export function mapDbMessageToView(
  row: DbMessage,
  currentUserId: string
): InboxMessageView {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    from: row.sender_id === currentUserId ? "you" : "them"
  };
}
