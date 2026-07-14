import type { PostCategory, PostKind } from "@/lib/posts";

export type DbPost = {
  id: string;
  user_id: string;
  kind: PostKind;
  category: PostCategory;
  caption: string;
  image_url: string | null;
  before_image_url: string | null;
  after_image_url: string | null;
  location: string | null;
  tags: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
};

export type CreatePostInput = {
  kind: PostKind;
  category: PostCategory;
  caption: string;
  location?: string;
  tags?: string[];
  /** Local preview URLs for UI while uploading */
  imagePreview?: string;
  beforePreview?: string;
  afterPreview?: string;
  /** Actual files to compress + upload (not used for motivation) */
  imageFile?: File;
  beforeFile?: File;
  afterFile?: File;
};

export type DbPostComment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type PostCommentAuthor = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type PostCommentRow = DbPostComment & {
  profiles: PostCommentAuthor | PostCommentAuthor[] | null;
};

export type PostCommentView = {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
  author: string;
  handle: string;
  avatar: string;
};

export const COMMENT_MAX_LENGTH = 500;
