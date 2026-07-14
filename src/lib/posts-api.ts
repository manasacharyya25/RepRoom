import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadImage } from "@/lib/media";
import type { CreatePostInput, DbPost } from "@/lib/types/post";

export const POSTS_BUCKET = "posts" as const;

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

export async function listUserPosts(
  supabase: SupabaseClient,
  userId: string,
  limit = 40
): Promise<DbPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as DbPost[];
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
