"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FEED_POSTS, type FeedPost } from "@/lib/feed-posts";
import { LIVE_IMAGES } from "@/lib/live-images";

type LocalComment = {
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
        />
      </div>
    );
  }

  if (post.kind === "transform") {
    return (
      <div className="feed-post-transform">
        <div className="feed-post-transform-half">
          <Image
            alt=""
            className="feed-post-image"
            fill
            priority={priority}
            sizes={sizes}
            src={post.beforeImage}
          />
          <span className="feed-post-transform-label">Day 1</span>
        </div>
        <div className="feed-post-transform-half">
          <Image
            alt=""
            className="feed-post-image"
            fill
            sizes={sizes}
            src={post.afterImage}
          />
          <span className="feed-post-transform-label">Day 60</span>
        </div>
        <span className="feed-post-transform-handle" aria-hidden>
          ⇔
        </span>
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

function usePostInteractions(post: FeedPost) {
  const [liked, setLiked] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<LocalComment[]>(() => seedComments(post));

  const likeCount = post.likes + (liked ? 1 : 0);
  const commentCount = useMemo(
    () => Math.max(post.comments, comments.length),
    [post.comments, comments.length]
  );

  const onLike = () => {
    setLiked((prev) => !prev);
    setLikeBurst(true);
    window.setTimeout(() => setLikeBurst(false), 320);
  };

  const sendComment = () => {
    const text = draft.trim();
    if (!text) return;

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
  };

  return {
    liked,
    likeBurst,
    commentsOpen,
    setCommentsOpen,
    draft,
    setDraft,
    comments,
    likeCount,
    commentCount,
    onLike,
    sendComment
  };
}

function CommentPanel({
  postId,
  comments,
  draft,
  setDraft,
  sendComment,
  emptyLabel = "Be the first to comment.",
  layout = "inline"
}: {
  postId: string;
  comments: LocalComment[];
  draft: string;
  setDraft: (value: string) => void;
  sendComment: () => void;
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
      />
      <button
        className="feed-post-comment-send"
        type="submit"
        disabled={!draft.trim()}
      >
        Post
      </button>
    </form>
  );

  const list =
    comments.length > 0 ? (
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
        {composer}
      </div>
    );
  }

  return (
    <div className="feed-post-comments">
      {list}
      {composer}
    </div>
  );
}

function FeedPostCard({
  post,
  allowComments,
  onOpen
}: {
  post: FeedPost;
  allowComments: boolean;
  onOpen?: () => void;
}) {
  const {
    liked,
    likeBurst,
    commentsOpen,
    setCommentsOpen,
    draft,
    setDraft,
    comments,
    likeCount,
    commentCount,
    onLike,
    sendComment
  } = usePostInteractions(post);

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
        <div className="feed-post-avatar">
          <Image
            alt=""
            className="feed-post-avatar-image"
            fill
            sizes="36px"
            src={post.avatar}
          />
        </div>
        <div>
          <p className="feed-post-author">{post.author}</p>
          <p className="feed-post-handle">{post.handle}</p>
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
          onClick={(event) => {
            event.stopPropagation();
            onLike();
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
            sendComment={sendComment}
          />
        </div>
      ) : null}
    </article>
  );
}

function FeedPostModal({
  post,
  allowComments,
  onClose
}: {
  post: FeedPost;
  allowComments: boolean;
  onClose: () => void;
}) {
  const {
    liked,
    likeBurst,
    draft,
    setDraft,
    comments,
    likeCount,
    commentCount,
    onLike,
    sendComment
  } = usePostInteractions(post);

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
        aria-label={`Post by ${post.author}`}
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
              <div className="feed-post-avatar">
                <Image
                  alt=""
                  className="feed-post-avatar-image"
                  fill
                  sizes="40px"
                  src={post.avatar}
                />
              </div>
              <div>
                <p className="feed-post-author">{post.author}</p>
                <p className="feed-post-handle">{post.handle}</p>
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
                onClick={onLike}
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
              sendComment={sendComment}
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
  posts = FEED_POSTS,
  subtitle = "For you",
  title = "Community Feed"
}: {
  className?: string;
  decorative?: boolean;
  allowComments?: boolean;
  enableLoadMore?: boolean;
  posts?: FeedPost[];
  subtitle?: string;
  title?: string;
}) {
  const pageSize = 6;
  const [visibleCount, setVisibleCount] = useState(
    enableLoadMore ? Math.min(pageSize, posts.length) : posts.length
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const visiblePosts = useMemo(
    () => posts.slice(0, visibleCount),
    [posts, visibleCount]
  );
  const hasMore = enableLoadMore && visibleCount < posts.length;
  const activePost = visiblePosts.find((post) => post.id === activePostId) ?? null;
  const canOpenModal = allowComments;

  const loadMore = () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount((count) => Math.min(count + pageSize, posts.length));
      setIsLoadingMore(false);
    }, 350);
  };

  return (
    <>
      <div className={`feed-mock${className ? ` ${className}` : ""}`}>
        <div className="feed-mock-header">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <div className="feed-mock-posts">
          {visiblePosts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              allowComments={allowComments}
              onOpen={
                canOpenModal ? () => setActivePostId(post.id) : undefined
              }
            />
          ))}
        </div>

        {enableLoadMore ? (
          <div className="feed-load-more">
            {hasMore ? (
              <button
                type="button"
                className="feed-load-more-btn"
                onClick={loadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </button>
            ) : (
              <p className="feed-load-more-done">You’re all caught up</p>
            )}
          </div>
        ) : null}
      </div>

      {activePost ? (
        <FeedPostModal
          post={activePost}
          allowComments={allowComments}
          onClose={() => setActivePostId(null)}
        />
      ) : null}
    </>
  );
}
