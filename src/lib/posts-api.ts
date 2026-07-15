import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadImage } from "@/lib/media";
import { LIVE_IMAGES } from "@/lib/live-images";
import type {
  CreatePostInput,
  DbPost,
  PostCommentAuthor,
  PostCommentRow,
  PostCommentView
} from "@/lib/types/post";
import { COMMENT_MAX_LENGTH } from "@/lib/types/post";

export const POSTS_BUCKET = "posts" as const;
export const POSTS_PAGE_SIZE = 9;
export const FEED_PAGE_SIZE = 100;

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function uploadPostImage(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  kind: "post" | "before" | "after"
) {
  const path = `${userId}/${kind}-${Date.now()}.webp`;

  const { publicUrl } = await uploadImage(supabase, {
    bucket: POSTS_BUCKET,
    path,
    file,
    preset: "post",
    compress: true,
    validate: true,
    upsert: true
  });

  return publicUrl;
}

export type ListUserPostsPage = {
  posts: DbPost[];
  hasMore: boolean;
  likedPostIds: string[];
};

async function fetchLikedPostIds(
  supabase: SupabaseClient,
  userId: string,
  postIds: string[]
): Promise<string[]> {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  if (error) throw error;
  return (data ?? []).map((row) => row.post_id as string);
}

export async function listUserPosts(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    /** Max posts per page (capped at POSTS_PAGE_SIZE). */
    limit?: number;
    /** Fetch posts older than this `created_at` timestamp (ISO). */
    before?: string | null;
  }
): Promise<ListUserPostsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? POSTS_PAGE_SIZE),
    POSTS_PAGE_SIZE
  );

  let query = supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data ?? []) as DbPost[];

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const likedPostIds = user
    ? await fetchLikedPostIds(
        supabase,
        user.id,
        posts.map((post) => post.id)
      )
    : [];

  return {
    posts,
    hasMore: posts.length === limit,
    likedPostIds
  };
}

export type FeedPostAuthor = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  age_range: string | null;
  country_code: string | null;
  goals?:
    | {
        template_id: string;
        current_value: number | null;
        target_value: number | null;
      }[]
    | null;
};

export type FeedPostRow = DbPost & {
  profiles: FeedPostAuthor | FeedPostAuthor[] | null;
};

export type ListFeedPostsPage = {
  posts: FeedPostRow[];
  hasMore: boolean;
  likedPostIds: string[];
};

function normalizeFeedAuthor(
  profiles: FeedPostRow["profiles"]
): FeedPostAuthor | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
}

export async function listFeedPosts(
  supabase: SupabaseClient,
  options?: {
    /** Max posts per page (capped at FEED_PAGE_SIZE). */
    limit?: number;
    /** Fetch posts older than this `created_at` timestamp (ISO). */
    before?: string | null;
  }
): Promise<ListFeedPostsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? FEED_PAGE_SIZE),
    FEED_PAGE_SIZE
  );

  let query = supabase
    .from("posts")
    .select(
      `
      *,
      profiles!posts_user_id_fkey (
        display_name,
        username,
        avatar_url,
        age_range,
        country_code,
        goals (
          template_id,
          current_value,
          target_value
        )
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;
  if (error) throw error;

  const posts = ((data ?? []) as FeedPostRow[]).map((row) => ({
    ...row,
    profiles: normalizeFeedAuthor(row.profiles)
  }));

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const likedPostIds = user
    ? await fetchLikedPostIds(
        supabase,
        user.id,
        posts.map((post) => post.id)
      )
    : [];

  return {
    posts,
    hasMore: posts.length === limit,
    likedPostIds
  };
}

export async function createPost(
  supabase: SupabaseClient,
  userId: string,
  input: CreatePostInput,
  onProgress?: (progress: number) => void
): Promise<DbPost> {
  const report = (value: number) => onProgress?.(clampProgress(value));
  report(5);

  let imageUrl: string | null = null;
  let beforeImageUrl: string | null = null;
  let afterImageUrl: string | null = null;

  if (input.category === "motivation") {
    report(70);
  } else if (input.kind === "transform") {
    if (!input.beforeFile || !input.afterFile) {
      throw new Error("Before and after photos are required.");
    }
    report(15);
    beforeImageUrl = await uploadPostImage(
      supabase,
      userId,
      input.beforeFile,
      "before"
    );
    report(45);
    afterImageUrl = await uploadPostImage(
      supabase,
      userId,
      input.afterFile,
      "after"
    );
    report(75);
  } else {
    if (!input.imageFile) {
      throw new Error("A photo is required for this post type.");
    }
    report(20);
    imageUrl = await uploadPostImage(supabase, userId, input.imageFile, "post");
    report(75);
  }

  const payload = {
    user_id: userId,
    kind: input.kind,
    category: input.category,
    caption: input.caption.trim(),
    image_url: imageUrl,
    before_image_url: beforeImageUrl,
    after_image_url: afterImageUrl,
    location: input.location?.trim() || null,
    tags: input.tags ?? []
  };

  report(85);

  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  report(100);
  return data as DbPost;
}

export async function updatePostCaption(
  supabase: SupabaseClient,
  postId: string,
  caption: string
): Promise<DbPost> {
  const trimmed = caption.trim();
  if (!trimmed) throw new Error("Caption cannot be empty.");
  if (trimmed.length > 500) throw new Error("Caption is too long.");

  const { data, error } = await supabase
    .from("posts")
    .update({ caption: trimmed })
    .eq("id", postId)
    .select("*")
    .single();

  if (error) throw error;
  return data as DbPost;
}

export async function deletePost(
  supabase: SupabaseClient,
  postId: string
): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

function normalizeCommentAuthor(
  profiles: PostCommentRow["profiles"]
): PostCommentAuthor | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
}

export function mapCommentRow(row: PostCommentRow): PostCommentView {
  const profile = normalizeCommentAuthor(row.profiles);
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    author: profile?.display_name?.trim() || "Athlete",
    handle: profile?.username ? `@${profile.username}` : "@athlete",
    avatar: profile?.avatar_url?.trim() || LIVE_IMAGES.participant4
  };
}

export async function togglePostLike(
  supabase: SupabaseClient,
  postId: string,
  currentlyLiked: boolean
): Promise<{ liked: boolean; likesCount: number }> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to like posts.");

  if (currentlyLiked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("post_likes").insert({
      post_id: postId,
      user_id: user.id
    });
    if (error) throw error;
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("likes_count")
    .eq("id", postId)
    .single();
  if (postError) throw postError;

  return {
    liked: !currentlyLiked,
    likesCount: Number(post?.likes_count ?? 0)
  };
}

export async function listPostComments(
  supabase: SupabaseClient,
  postId: string
): Promise<PostCommentView[]> {
  const { data, error } = await supabase
    .from("post_comments")
    .select(
      `
      *,
      profiles (
        display_name,
        username,
        avatar_url
      )
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as PostCommentRow[]).map(mapCommentRow);
}

export async function createPostComment(
  supabase: SupabaseClient,
  postId: string,
  body: string
): Promise<{ comment: PostCommentView; commentsCount: number }> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment cannot be empty.");
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    throw new Error("Comment is too long.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to comment.");

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      body: trimmed
    })
    .select(
      `
      *,
      profiles (
        display_name,
        username,
        avatar_url
      )
    `
    )
    .single();

  if (error) throw error;

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("comments_count")
    .eq("id", postId)
    .single();
  if (postError) throw postError;

  return {
    comment: mapCommentRow(data as PostCommentRow),
    commentsCount: Number(post?.comments_count ?? 0)
  };
}
