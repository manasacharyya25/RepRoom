"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedPost } from "@/lib/feed-posts";
import { LIVE_IMAGES } from "@/lib/live-images";
import {
  createPostComment,
  listPostComments,
  togglePostLike
} from "@/lib/posts-api";
import { createClient } from "@/lib/supabase/client";

export type LocalComment = {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  text: string;
};

function seedComments(post: FeedPost): LocalComment[] {
  const count = Math.min(post.comments, 2);
  if (count === 0) return [];

  const seeds: LocalComment[] = [
    {
      id: `${post.id}-c1`,
      author: "Maya",
      handle: "@maya_moves",
      avatar: LIVE_IMAGES.sidebar2,
      text: "This is motivating — keep going!"
    },
    {
      id: `${post.id}-c2`,
      author: "Alex",
      handle: "@alex_runs",
      avatar: LIVE_IMAGES.participant1,
      text: "Love the consistency here."
    }
  ];

  return seeds.slice(0, count);
}

function commentViewToLocal(comment: {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  body: string;
}): LocalComment {
  return {
    id: comment.id,
    author: comment.author,
    handle: comment.handle,
    avatar: comment.avatar,
    text: comment.body
  };
}

export function usePostInteractions(
  post: FeedPost,
  options: {
    persist: boolean;
    autoLoadComments?: boolean;
    onStatsChange?: (
      postId: string,
      stats: { likes: number; comments: number; likedByMe: boolean }
    ) => void;
  }
) {
  const { persist, autoLoadComments = false, onStatsChange } = options;
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [likeCount, setLikeCount] = useState(post.likes);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [likeBurst, setLikeBurst] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(autoLoadComments);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<LocalComment[]>(() =>
    persist ? [] : seedComments(post)
  );
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const commentsLoadedRef = useRef(false);

  useEffect(() => {
    setLiked(Boolean(post.likedByMe));
    setLikeCount(post.likes);
    setCommentCount(post.comments);
    if (!persist) {
      setComments(seedComments(post));
      commentsLoadedRef.current = false;
    }
  }, [post.id, post.likedByMe, post.likes, post.comments, persist]);

  useEffect(() => {
    if (!persist || !commentsOpen || commentsLoadedRef.current) return;

    let cancelled = false;
    const load = async () => {
      setCommentsLoading(true);
      setActionError(null);
      try {
        const supabase = createClient();
        const rows = await listPostComments(supabase, post.id);
        if (cancelled) return;
        setComments(rows.map(commentViewToLocal));
        commentsLoadedRef.current = true;
      } catch (error) {
        if (!cancelled) {
          setActionError(
            error instanceof Error
              ? error.message
              : "Could not load comments."
          );
        }
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [persist, commentsOpen, post.id]);

  const onLike = async () => {
    if (likeBusy) return;
    setLikeBurst(true);
    window.setTimeout(() => setLikeBurst(false), 320);

    if (!persist) {
      setLiked((prev) => !prev);
      setLikeCount((count) => count + (liked ? -1 : 1));
      return;
    }

    const previousLiked = liked;
    const previousCount = likeCount;
    const nextLiked = !previousLiked;
    setLiked(nextLiked);
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
    setLikeBusy(true);
    setActionError(null);

    try {
      const supabase = createClient();
      const result = await togglePostLike(supabase, post.id, previousLiked);
      setLiked(result.liked);
      setLikeCount(result.likesCount);
      onStatsChange?.(post.id, {
        likes: result.likesCount,
        comments: commentCount,
        likedByMe: result.liked
      });
    } catch (error) {
      setLiked(previousLiked);
      setLikeCount(previousCount);
      setActionError(
        error instanceof Error ? error.message : "Could not update like."
      );
    } finally {
      setLikeBusy(false);
    }
  };

  const sendComment = async () => {
    const text = draft.trim();
    if (!text || commentBusy) return;

    if (!persist) {
      setComments((prev) => [
        ...prev,
        {
          id: `${post.id}-${Date.now()}`,
          author: "You",
          handle: "@you",
          avatar: LIVE_IMAGES.participant4,
          text
        }
      ]);
      setDraft("");
      setCommentsOpen(true);
      setCommentCount((count) => count + 1);
      return;
    }

    setCommentBusy(true);
    setActionError(null);
    try {
      const supabase = createClient();
      const result = await createPostComment(supabase, post.id, text);
      setComments((prev) => [...prev, commentViewToLocal(result.comment)]);
      setCommentCount(result.commentsCount);
      setDraft("");
      setCommentsOpen(true);
      commentsLoadedRef.current = true;
      onStatsChange?.(post.id, {
        likes: likeCount,
        comments: result.commentsCount,
        likedByMe: liked
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not post comment."
      );
    } finally {
      setCommentBusy(false);
    }
  };

  return {
    liked,
    likeBurst,
    likeBusy,
    commentsOpen,
    setCommentsOpen,
    draft,
    setDraft,
    comments,
    commentsLoading,
    commentBusy,
    actionError,
    likeCount,
    commentCount,
    onLike,
    sendComment
  };
}
