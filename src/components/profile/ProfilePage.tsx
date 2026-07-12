"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { LIVE_IMAGES } from "@/lib/live-images";

type Goal = {
  id: string;
  title: string;
  progress: number;
  detail: string;
};

type SelfPost = {
  id: string;
  caption: string;
  image?: string;
  createdAt: string;
  likes: number;
  comments: number;
};

const INITIAL_GOALS: Goal[] = [
  {
    id: "g1",
    title: "Train 5 days a week",
    progress: 72,
    detail: "4 / 5 sessions this week"
  },
  {
    id: "g2",
    title: "Hit a 100kg squat",
    progress: 85,
    detail: "Current: 95kg"
  },
  {
    id: "g3",
    title: "Morning mobility streak",
    progress: 40,
    detail: "8 day streak"
  }
];

const INITIAL_POSTS: SelfPost[] = [
  {
    id: "p1",
    caption: "Heavy day done. Showing up matters more than perfect form every time.",
    image: LIVE_IMAGES.participant4,
    createdAt: "2h ago",
    likes: 24,
    comments: 5
  },
  {
    id: "p2",
    caption: "Meal prep locked for the week. Consistency over perfection.",
    image: LIVE_IMAGES.participant8,
    createdAt: "Yesterday",
    likes: 41,
    comments: 8
  },
  {
    id: "p3",
    caption: "Morning flow with the yoga room. Feeling reset.",
    createdAt: "3 days ago",
    likes: 18,
    comments: 2
  }
];

export function ProfilePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const identityRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<SelfPost[]>(INITIAL_POSTS);
  const [goals, setGoals] = useState<Goal[]>(INITIAL_GOALS);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showGoals, setShowGoals] = useState(false);

  useEffect(() => {
    const identity = identityRef.current;
    const composer = composerRef.current;
    if (!identity || !composer) return;

    const syncHeight = () => {
      if (window.matchMedia("(max-width: 960px)").matches) {
        composer.style.height = "";
        return;
      }
      composer.style.height = `${identity.getBoundingClientRect().height}px`;
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(identity);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, []);

  const canPost = useMemo(
    () => draft.trim().length > 0 || Boolean(previewUrl),
    [draft, previewUrl]
  );

  const clearComposer = () => {
    setDraft("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setShowEmojis(false);
    setShowGoals(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (gifInputRef.current) gifInputRef.current.value = "";
  };

  const onSelectImage = (file: File | null) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setDraft((prev) => `${prev}${snippet}`);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${snippet}${draft.slice(end)}`;
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const publish = () => {
    if (!canPost) return;
    setPosts((prev) => [
      {
        id: `local-${Date.now()}`,
        caption: draft.trim() || "New update",
        image: previewUrl ?? undefined,
        createdAt: "Just now",
        likes: 0,
        comments: 0
      },
      ...prev
    ]);
    clearComposer();
  };

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <aside className="profile-identity" ref={identityRef}>
          <div className="profile-avatar">
            <Image
              alt=""
              className="profile-avatar-image"
              fill
              sizes="160px"
              src={LIVE_IMAGES.participant4}
              priority
            />
          </div>
          <div className="profile-identity-copy">
            <h1>You</h1>
            <p className="profile-handle">@you</p>
            <p className="profile-bio">
              Building strength one session at a time. Yoga · Cardio · Accountability.
            </p>
            <div className="profile-stats">
              <span>
                <strong>{posts.length}</strong> posts
              </span>
              <span>
                <strong>12</strong> rooms joined
              </span>
              <span>
                <strong>21</strong> day streak
              </span>
            </div>
          </div>
        </aside>

        <div className="profile-composer" ref={composerRef}>
          <div className="profile-compose-main">
            <h2>Share an update</h2>
            <textarea
              ref={textareaRef}
              className="profile-composer-input"
              placeholder="What's happening?"
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />

            {previewUrl ? (
              <div className="profile-composer-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  src={previewUrl}
                  className="profile-composer-preview-image"
                />
                <button
                  type="button"
                  className="profile-composer-remove"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    if (gifInputRef.current) gifInputRef.current.value = "";
                  }}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>

          <div className="profile-compose-toolbar">
            <div className="profile-compose-tools">
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(event) => onSelectImage(event.target.files?.[0] ?? null)}
              />
              <input
                ref={gifInputRef}
                className="sr-only"
                type="file"
                accept="image/gif"
                onChange={(event) => onSelectImage(event.target.files?.[0] ?? null)}
              />

              <button
                type="button"
                className="profile-compose-tool"
                aria-label="Add image"
                title="Image"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25V6.75Zm2.75-.25a.25.25 0 0 0-.25.25v7.19l2.72-2.72a1.75 1.75 0 0 1 2.47 0l1.53 1.53 3.22-3.22a1.75 1.75 0 0 1 2.47 0L20.5 12.7V6.75a.25.25 0 0 0-.25-.25H5.75Zm0 10.75h12.5a.25.25 0 0 0 .25-.25v-2.19l-3.47-3.47a.25.25 0 0 0-.35 0l-3.4 3.4a.75.75 0 0 1-1.06 0l-1.53-1.53a.25.25 0 0 0-.35 0L5.5 16.81v.44c0 .138.112.25.25.25ZM15 9.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" />
                </svg>
              </button>

              <button
                type="button"
                className="profile-compose-tool"
                aria-label="Add GIF"
                title="GIF"
                onClick={() => gifInputRef.current?.click()}
              >
                <span className="profile-compose-gif">GIF</span>
              </button>

              <button
                type="button"
                className="profile-compose-tool"
                aria-label="Add poll"
                title="Poll"
                onClick={() =>
                  insertAtCursor("\n📊 Poll\n• Option 1\n• Option 2\n")
                }
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M5 4.75A.75.75 0 0 1 5.75 4h2.5a.75.75 0 0 1 .75.75v14.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1-.75-.75V4.75Zm5.5 5A.75.75 0 0 1 11.25 9h2.5a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1-.75-.75v-9.5Zm5.5-3A.75.75 0 0 1 16.75 6h2.5a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1-.75-.75V6.75Z" />
                </svg>
              </button>

              <button
                type="button"
                className="profile-compose-tool"
                aria-label="Add bullets"
                title="Bullets"
                onClick={() => insertAtCursor("\n• ")}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M7.5 6.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM10 6.25a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75ZM7.5 12a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm2.5-.25a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75ZM7.5 17.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm2.5-.25a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75Z" />
                </svg>
              </button>

              <div className="profile-compose-tool-wrap">
                <button
                  type="button"
                  className="profile-compose-tool"
                  aria-label="Add emoji"
                  title="Emoji"
                  aria-expanded={showEmojis}
                  onClick={() => {
                    setShowGoals(false);
                    setShowEmojis((open) => !open);
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Zm0 1.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-3.25 5.25a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm6.5 0a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM8.8 14.2a.75.75 0 0 1 1.05.1 3.25 3.25 0 0 0 5.3 0 .75.75 0 1 1 1.15.96 4.75 4.75 0 0 1-7.6 0 .75.75 0 0 1 .1-1.06Z" />
                  </svg>
                </button>
                {showEmojis ? (
                  <div className="profile-compose-popover" role="listbox" aria-label="Emojis">
                    {["💪", "🔥", "😊", "🏃", "🧘", "✅", "🎯", "❤️"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="profile-compose-emoji"
                        onClick={() => {
                          insertAtCursor(emoji);
                          setShowEmojis(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="profile-compose-tool"
                aria-label="Schedule"
                title="Schedule"
                onClick={() => insertAtCursor(" 🗓️ ")}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M7.75 3a.75.75 0 0 1 .75.75V5h7V3.75a.75.75 0 0 1 1.5 0V5h.75A2.75 2.75 0 0 1 20.5 7.75v10.5A2.75 2.75 0 0 1 17.75 21H6.25A2.75 2.75 0 0 1 3.5 18.25V7.75A2.75 2.75 0 0 1 6.25 5H7V3.75A.75.75 0 0 1 7.75 3ZM5 9.5h14v8.75c0 .69-.56 1.25-1.25 1.25H6.25c-.69 0-1.25-.56-1.25-1.25V9.5Z" />
                </svg>
              </button>

              <div className="profile-compose-tool-wrap">
                <button
                  type="button"
                  className="profile-compose-tool"
                  aria-label="Set a goal"
                  title="Goal"
                  aria-expanded={showGoals}
                  onClick={() => {
                    setShowEmojis(false);
                    setShowGoals((open) => !open);
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M5.5 3.75A.75.75 0 0 1 6.25 3h9.5a.75.75 0 0 1 .53.22l3.5 3.5a.75.75 0 0 1-.53 1.28H16.5v11.25a.75.75 0 0 1-1.2.6l-3.3-2.48-3.3 2.48a.75.75 0 0 1-1.2-.6V8H6.25a.75.75 0 0 1-.75-.75v-3.5ZM9 8v9.05l2.55-1.92a.75.75 0 0 1 .9 0L15 17.05V8H9Zm7.5-1.5h1.94L16.5 4.56V6.5ZM7.5 4.5v2H15V4.5H7.5Z" />
                  </svg>
                </button>
                {showGoals ? (
                  <div className="profile-compose-popover profile-compose-popover--goals">
                    {goals.map((goal) => (
                      <button
                        key={goal.id}
                        type="button"
                        className="profile-compose-goal-option"
                        onClick={() => {
                          insertAtCursor(`🎯 Goal: ${goal.title} (${goal.progress}%) `);
                          setShowGoals(false);
                        }}
                      >
                        <strong>{goal.title}</strong>
                        <span>{goal.progress}%</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="profile-compose-goal-option is-create"
                      onClick={() => {
                        const title = "New weekly goal";
                        setGoals((prev) => [
                          {
                            id: `g-${Date.now()}`,
                            title,
                            progress: 0,
                            detail: "Just set"
                          },
                          ...prev
                        ]);
                        insertAtCursor(`🎯 Goal set: ${title} `);
                        setShowGoals(false);
                      }}
                    >
                      + Create new goal
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              className="profile-compose-post"
              disabled={!canPost}
              onClick={publish}
            >
              Post
            </button>
          </div>
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Goals</h2>
          <span>Stay accountable</span>
        </div>
        <div className="profile-goals">
          {goals.map((goal) => (
            <article className="profile-goal-card" key={goal.id}>
              <div className="profile-goal-top">
                <strong>{goal.title}</strong>
                <span>{goal.progress}%</span>
              </div>
              <div className="profile-goal-track" aria-hidden>
                <span
                  className="profile-goal-fill"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
              <p>{goal.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Your posts</h2>
          <span>{posts.length} updates</span>
        </div>
        <div className="profile-posts">
          {posts.map((post) => (
            <article className="profile-post-card" key={post.id}>
              {post.image ? (
                <div className="profile-post-media">
                  <Image
                    alt=""
                    className="profile-post-image"
                    fill
                    sizes="(max-width: 960px) 100vw, 360px"
                    src={post.image}
                    unoptimized={post.image.startsWith("blob:")}
                  />
                </div>
              ) : null}
              <div className="profile-post-body">
                <p className="profile-post-caption">{post.caption}</p>
                <div className="profile-post-meta">
                  <span>{post.createdAt}</span>
                  <span>♥ {post.likes}</span>
                  <span>💬 {post.comments}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
