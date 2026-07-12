import Image from "next/image";
import { FEED_POSTS, type FeedPost } from "@/lib/feed-posts";

function FeedPostCard({ post }: { post: FeedPost }) {
  return (
    <article className="feed-post">
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

      {post.kind === "image" ? (
        <div className={`feed-post-media feed-post-media--${post.aspect}`}>
          <Image
            alt=""
            className="feed-post-image"
            fill
            sizes="(max-width: 960px) 50vw, 280px"
            src={post.image}
          />
        </div>
      ) : null}

      {post.kind === "transform" ? (
        <div className="feed-post-transform">
          <div className="feed-post-transform-half">
            <Image
              alt=""
              className="feed-post-image"
              fill
              sizes="140px"
              src={post.beforeImage}
            />
            <span className="feed-post-transform-label">Day 1</span>
          </div>
          <div className="feed-post-transform-half">
            <Image
              alt=""
              className="feed-post-image"
              fill
              sizes="140px"
              src={post.afterImage}
            />
            <span className="feed-post-transform-label">Day 60</span>
          </div>
          <span className="feed-post-transform-handle" aria-hidden>
            ⇔
          </span>
        </div>
      ) : null}

      {post.kind === "quote" ? (
        <div className="feed-post-quote">
          <span className="feed-post-quote-mark" aria-hidden>
            “
          </span>
          <p>{post.quote}</p>
        </div>
      ) : null}

      {"caption" in post && post.caption ? (
        <p className="feed-post-caption">
          {post.caption}
          {"hashtag" in post && post.hashtag ? (
            <span className="feed-post-hashtag"> {post.hashtag}</span>
          ) : null}
        </p>
      ) : null}

      <div className="feed-post-actions">
        <span>♥ {post.likes}</span>
        <span>💬 {post.comments}</span>
      </div>
    </article>
  );
}

export function CommunityFeed({
  className,
  decorative = false,
  posts = FEED_POSTS,
  subtitle = "For you",
  title = "Community Feed"
}: {
  className?: string;
  decorative?: boolean;
  posts?: FeedPost[];
  subtitle?: string;
  title?: string;
}) {
  return (
    <div
      aria-hidden={decorative || undefined}
      className={`feed-mock${className ? ` ${className}` : ""}`}
    >
      <div className="feed-mock-header">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="feed-mock-posts">
        {posts.map((post) => (
          <FeedPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
