"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { FeedAuthorHoverCard } from "@/components/feed/FeedAuthorHoverCard";
import {
  usePostInteractions,
  type LocalComment
} from "@/components/feed/usePostInteractions";
import {
  FEED_POSTS,
  mapFeedRowToPost,
  type FeedPost
} from "@/lib/feed-posts";
import { createClient } from "@/lib/supabase/client";
import {
  FEED_PAGE_SIZE,
  listFeedPosts
} from "@/lib/posts-api";

function isRemoteSrc(src: string) {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("blob:")
  );
}

function PostMedia({
  post,
  priority = false,
  sizes
}: {
  post: FeedPost;
  priority?: boolean;
  sizes: string;
}) {
  if (post.kind === "image") {
    return (
      <div className={`feed-post-media feed-post-media--${post.aspect}`}>
        <Image
          alt=""
          className="feed-post-image"
          fill
          priority={priority}
          sizes={sizes}
          src={post.image}
          unoptimized={isRemoteSrc(post.image)}
        />
      </div>
    );
  }

  if (post.kind === "transform") {
    return (
      <div
        className="feed-post-transform"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <BeforeAfterSlider
          afterLabel="Day 60"
          afterSrc={post.afterImage}
          beforeLabel="Day 1"
          beforeSrc={post.beforeImage}
        />
      </div>
    );
  }

  return (
    <div className="feed-post-quote">
      <span className="feed-post-quote-mark" aria-hidden>
        “
      </span>
      <p>{post.quote}</p>
    </div>
  );
}

function PostCaption({ post }: { post: FeedPost }) {
  if (!("caption" in post) || !post.caption) return null;

  return (
    <p className="feed-post-caption">
      {post.caption}
      {"hashtag" in post && post.hashtag ? (
        <span className="feed-post-hashtag"> {post.hashtag}</span>
      ) : null}
    </p>
  );
}

type PostStatsChange = (
  postId: string,
  stats: { likes: number; comments: number; likedByMe: boolean }
) => void;

function CommentPanel({
  postId,
  comments,
  draft,
  setDraft,
  sendComment,
  commentsLoading = false,
  commentBusy = false,
  actionError = null,
  emptyLabel = "Be the first to comment.",
  layout = "inline"
}: {
  postId: string;
  comments: LocalComment[];
  draft: string;
  setDraft: (value: string) => void;
  sendComment: () => void;
  commentsLoading?: boolean;
  commentBusy?: boolean;
  actionError?: string | null;
  emptyLabel?: string;
  layout?: "inline" | "modal";
}) {
  const composer = (
    <form
      className="feed-post-comment-composer"
      onSubmit={(event) => {
        event.preventDefault();
        sendComment();
      }}
    >
      <label className="sr-only" htmlFor={`comment-${postId}`}>
        Write a comment
      </label>
      <textarea
        id={`comment-${postId}`}
        className="feed-post-comment-input"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendComment();
          }
        }}
        placeholder="Write a comment…"
        rows={2}
        value={draft}
        disabled={commentBusy}
      />
      <button
        className="feed-post-comment-send"
        type="submit"
        disabled={!draft.trim() || commentBusy}
      >
        {commentBusy ? "…" : "Post"}
      </button>
    </form>
  );

  const list = commentsLoading ? (
    <p className="feed-post-comments-empty">Loading comments…</p>
  ) : comments.length > 0 ? (
    <ul className="feed-post-comment-list">
      {comments.map((comment) => (
        <li className="feed-post-comment" key={comment.id}>
          <span className="feed-post-comment-avatar">
            <Image
              alt=""
              className="feed-post-avatar-image"
              fill
              sizes="28px"
              src={comment.avatar}
              unoptimized={isRemoteSrc(comment.avatar)}
            />
          </span>
          <div className="feed-post-comment-body">
            <p className="feed-post-comment-meta">
              <strong>{comment.author}</strong>
              <span>{comment.handle}</span>
            </p>
            <p className="feed-post-comment-text">{comment.text}</p>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p className="feed-post-comments-empty">{emptyLabel}</p>
  );

  if (layout === "modal") {
    return (
      <div className="feed-post-comments feed-post-comments--modal">
        <div className="feed-post-comments-scroll">{list}</div>
        {actionError ? (
          <p className="feed-post-manage-error">{actionError}</p>
        ) : null}
        {composer}
      </div>
    );
  }

  return (
    <div className="feed-post-comments">
      {list}
      {actionError ? (
        <p className="feed-post-manage-error">{actionError}</p>
      ) : null}
      {composer}
    </div>
  );
}

function FeedPostCard({
  post,
  allowComments,
  persist,
  onOpen,
  onStatsChange
}: {
  post: FeedPost;
  allowComments: boolean;
  persist: boolean;
  onOpen?: () => void;
  onStatsChange?: PostStatsChange;
}) {
  const {
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
  } = usePostInteractions(post, { persist, onStatsChange });

  return (
    <article
      className={`feed-post${commentsOpen ? " feed-post--comments-open" : ""}${
        onOpen ? " feed-post--openable" : ""
      }`}
      onClick={() => onOpen?.()}
      onKeyDown={(event) => {
        if (!onOpen) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <div className="feed-post-top">
        <FeedAuthorHoverCard author={post.author} size={32} />
        <div>
          <p className="feed-post-author">{post.author.name}</p>
          <p className="feed-post-handle">{post.author.handle}</p>
        </div>
      </div>

      <PostMedia post={post} sizes="(max-width: 960px) 50vw, 280px" />
      <PostCaption post={post} />

      <div className="feed-post-actions">
        <button
          type="button"
          className={`feed-post-action feed-post-like${liked ? " is-liked" : ""}${
            likeBurst ? " is-burst" : ""
          }`}
          aria-label={liked ? "Unlike" : "Like"}
          aria-pressed={liked}
          disabled={likeBusy}
          onClick={(event) => {
            event.stopPropagation();
            void onLike();
          }}
        >
          <span aria-hidden>{liked ? "♥" : "♡"}</span> {likeCount}
        </button>
        <button
          type="button"
          className={`feed-post-action feed-post-comment${commentsOpen ? " is-open" : ""}`}
          aria-label="Comments"
          aria-expanded={allowComments ? commentsOpen : undefined}
          onClick={(event) => {
            event.stopPropagation();
            if (!allowComments) return;
            if (onOpen) {
              onOpen();
              return;
            }
            setCommentsOpen((prev) => !prev);
          }}
        >
          <span aria-hidden>💬</span> {commentCount}
        </button>
      </div>

      {actionError && !commentsOpen ? (
        <p className="feed-post-manage-error">{actionError}</p>
      ) : null}

      {allowComments && commentsOpen && !onOpen ? (
        <div
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <CommentPanel
            postId={post.id}
            comments={comments}
            draft={draft}
            setDraft={setDraft}
            sendComment={() => void sendComment()}
            commentsLoading={commentsLoading}
            commentBusy={commentBusy}
            actionError={actionError}
          />
        </div>
      ) : null}
    </article>
  );
}

function FeedPostModal({
  post,
  allowComments,
  persist,
  onClose,
  onStatsChange
}: {
  post: FeedPost;
  allowComments: boolean;
  persist: boolean;
  onClose: () => void;
  onStatsChange?: PostStatsChange;
}) {
  const {
    liked,
    likeBurst,
    likeBusy,
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
  } = usePostInteractions(post, {
    persist,
    autoLoadComments: true,
    onStatsChange
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="feed-post-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="feed-post-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Post by ${post.author.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="feed-post-modal-close"
          aria-label="Close post"
          onClick={onClose}
        >
          ×
        </button>

        <div className="feed-post-modal-media">
          <PostMedia
            post={post}
            priority
            sizes="(max-width: 900px) 100vw, 640px"
          />
        </div>

        <div className="feed-post-modal-side">
          <div className="feed-post-modal-side-top">
            <div className="feed-post-top">
              <FeedAuthorHoverCard author={post.author} size={40} />
              <div>
                <p className="feed-post-author">{post.author.name}</p>
                <p className="feed-post-handle">{post.author.handle}</p>
              </div>
            </div>

            <PostCaption post={post} />

            <div className="feed-post-actions">
              <button
                type="button"
                className={`feed-post-action feed-post-like${liked ? " is-liked" : ""}${
                  likeBurst ? " is-burst" : ""
                }`}
                aria-label={liked ? "Unlike" : "Like"}
                aria-pressed={liked}
                disabled={likeBusy}
                onClick={() => void onLike()}
              >
                <span aria-hidden>{liked ? "♥" : "♡"}</span> {likeCount}
              </button>
              <span className="feed-post-action feed-post-comment is-open">
                <span aria-hidden>💬</span> {commentCount}
              </span>
            </div>
          </div>

          {allowComments ? (
            <CommentPanel
              layout="modal"
              postId={`modal-${post.id}`}
              comments={comments}
              draft={draft}
              setDraft={setDraft}
              sendComment={() => void sendComment()}
              commentsLoading={commentsLoading}
              commentBusy={commentBusy}
              actionError={actionError}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CommunityFeed({
  className,
  decorative: _decorative = false,
  allowComments = false,
  enableLoadMore = false,
  hideHeader = false,
  posts: initialPosts = FEED_POSTS,
  subtitle = "For you",
  title = "Community Feed"
}: {
  className?: string;
  decorative?: boolean;
  allowComments?: boolean;
  enableLoadMore?: boolean;
  hideHeader?: boolean;
  posts?: FeedPost[];
  subtitle?: string;
  title?: string;
}) {
  const live = enableLoadMore;
  const [posts, setPosts] = useState<FeedPost[]>(() =>
    live ? [] : initialPosts
  );
  const [loading, setLoading] = useState(live);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  useEffect(() => {
    if (live) return;
    setPosts(initialPosts);
    setLoading(false);
    setHasMore(false);
    setLoadError(null);
  }, [live, initialPosts]);

  useEffect(() => {
    if (!live) return;

    let cancelled = false;

    const loadInitial = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const supabase = createClient();
        const page = await listFeedPosts(supabase, {
          limit: FEED_PAGE_SIZE
        });
        if (cancelled) return;
        const liked = new Set(page.likedPostIds);
        setPosts(
          page.posts.map((row) => mapFeedRowToPost(row, liked.has(row.id)))
        );
        setHasMore(page.hasMore);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPosts([]);
          setHasMore(false);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load the feed."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [live]);

  const activePost = posts.find((post) => post.id === activePostId) ?? null;
  const canOpenModal = allowComments;

  const updatePostStats: PostStatsChange = (postId, stats) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              likes: stats.likes,
              comments: stats.comments,
              likedByMe: stats.likedByMe
            }
          : post
      )
    );
  };

  const loadMore = async () => {
    if (!live || !hasMore || isLoadingMore || posts.length === 0) return;
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      const oldest = posts[posts.length - 1];
      const page = await listFeedPosts(supabase, {
        limit: FEED_PAGE_SIZE,
        before: oldest.createdAtIso ?? null
      });

      setPosts((prev) => {
        const seen = new Set(prev.map((post) => post.id));
        const liked = new Set(page.likedPostIds);
        const next = page.posts
          .map((row) => mapFeedRowToPost(row, liked.has(row.id)))
          .filter((post) => !seen.has(post.id));
        return [...prev, ...next];
      });
      setHasMore(page.hasMore);
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error ? error.message : "Could not load more posts."
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <>
      <div className={`feed-mock${className ? ` ${className}` : ""}`}>
        {hideHeader ? null : (
          <div className="feed-mock-header">
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
        )}
        <div className="feed-mock-posts">
          {loading ? (
            <p className="feed-posts-status">Loading posts…</p>
          ) : null}
          {!loading && posts.length === 0 ? (
            <p className="feed-posts-status">
              {loadError ?? "No posts yet. Be the first to share an update."}
            </p>
          ) : null}
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              allowComments={allowComments}
              persist={live}
              onStatsChange={live ? updatePostStats : undefined}
              onOpen={
                canOpenModal ? () => setActivePostId(post.id) : undefined
              }
            />
          ))}
        </div>

        {enableLoadMore && !loading ? (
          <div className="feed-load-more">
            {loadError && posts.length > 0 ? (
              <p className="feed-load-more-error">{loadError}</p>
            ) : null}
            {hasMore ? (
              <button
                type="button"
                className="feed-load-more-btn"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </button>
            ) : posts.length > 0 ? (
              <p className="feed-load-more-done">You’re all caught up</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {activePost ? (
        <FeedPostModal
          post={activePost}
          allowComments={allowComments}
          persist={live}
          onStatsChange={live ? updatePostStats : undefined}
          onClose={() => setActivePostId(null)}
        />
      ) : null}
    </>
  );
}
