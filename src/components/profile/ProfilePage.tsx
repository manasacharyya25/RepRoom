"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ProfileComposer,
  type ComposerPublishPayload
} from "@/components/profile/ProfileComposer";
import { PostUploadPreview } from "@/components/profile/PostUploadPreview";
import { ProfileEditDrawer } from "@/components/profile/ProfileEditDrawer";
import { LIVE_IMAGES } from "@/lib/live-images";
import {
  formatGoalDetail,
  resolveGoalProgress
} from "@/lib/profile-format";
import { categoryLabel, type PostCategory, type PostKind } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";
import type { Goal as DbGoal, ProfileViewModel } from "@/lib/types/profile";
import "@/app/profile-edit.css";

type ProfileGoalCard = {
  id: string;
  title: string;
  progress: number;
  detail: string;
};

type SelfPost = {
  id: string;
  kind: PostKind;
  category: PostCategory;
  caption: string;
  image?: string;
  beforeImage?: string;
  afterImage?: string;
  location?: string;
  tags?: string[];
  createdAt: string;
  likes: number;
  comments: number;
};

const INITIAL_GOALS: ProfileGoalCard[] = [
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
    kind: "standard",
    category: "achievement",
    caption: "Heavy day done. Showing up matters more than perfect form every time.",
    image: LIVE_IMAGES.participant4,
    createdAt: "2h ago",
    likes: 24,
    comments: 5
  },
  {
    id: "p2",
    kind: "standard",
    category: "meal_prep",
    caption: "Meal prep locked for the week. Consistency over perfection.",
    image: LIVE_IMAGES.participant8,
    createdAt: "Yesterday",
    likes: 41,
    comments: 8
  },
  {
    id: "p3",
    kind: "standard",
    category: "motivation",
    caption: "Morning flow with the yoga room. Feeling reset.",
    image: LIVE_IMAGES.participant1,
    createdAt: "3 days ago",
    likes: 18,
    comments: 2
  },
  {
    id: "p4",
    kind: "standard",
    category: "pump_check",
    caption: "Cardio finishers hit different when the room is hyped.",
    image: LIVE_IMAGES.participant6,
    createdAt: "4 days ago",
    likes: 33,
    comments: 4
  },
  {
    id: "p5",
    kind: "standard",
    category: "achievement",
    caption: "New PR on deadlift. Slow progress still counts.",
    image: LIVE_IMAGES.participant3,
    createdAt: "5 days ago",
    likes: 56,
    comments: 11
  },
  {
    id: "p6",
    kind: "transform",
    category: "transformation",
    caption: "Recovery walk + stretch. Rest is part of the plan.",
    beforeImage: LIVE_IMAGES.participant2,
    afterImage: LIVE_IMAGES.participant4,
    createdAt: "1 week ago",
    likes: 14,
    comments: 1
  },
  {
    id: "p7",
    kind: "standard",
    category: "fit_check",
    caption: "Zumba night was chaotic in the best way.",
    image: LIVE_IMAGES.sidebar1,
    createdAt: "1 week ago",
    likes: 29,
    comments: 6
  },
  {
    id: "p8",
    kind: "standard",
    category: "meal_prep",
    caption: "Tracking protein for the next 14 days. Accountability unlocked.",
    image: LIVE_IMAGES.participant7,
    createdAt: "8 days ago",
    likes: 22,
    comments: 3
  },
  {
    id: "p9",
    kind: "standard",
    category: "motivation",
    caption: "First private room session with my buddies. We showed up.",
    image: LIVE_IMAGES.sidebar2,
    createdAt: "2 weeks ago",
    likes: 47,
    comments: 9
  },
  {
    id: "p10",
    kind: "standard",
    category: "pump_check",
    caption: "Early gym, empty racks, perfect playlist.",
    image: LIVE_IMAGES.participant2,
    createdAt: "2 weeks ago",
    likes: 31,
    comments: 4
  },
  {
    id: "p11",
    kind: "standard",
    category: "motivation",
    caption: "Meditation room helped me reset after a long week.",
    image: LIVE_IMAGES.participant5,
    createdAt: "3 weeks ago",
    likes: 19,
    comments: 2
  },
  {
    id: "p12",
    kind: "standard",
    category: "fit_check",
    caption: "Shared a form check. Got great feedback from the room.",
    image: LIVE_IMAGES.sidebar3,
    createdAt: "3 weeks ago",
    likes: 38,
    comments: 7
  },
  {
    id: "p13",
    kind: "standard",
    category: "achievement",
    caption: "Hit my weekly goal streak. Small wins add up.",
    image: LIVE_IMAGES.participant4,
    createdAt: "1 month ago",
    likes: 26,
    comments: 3
  },
  {
    id: "p14",
    kind: "standard",
    category: "weight_check",
    caption: "Leg day leftovers. Walking downstairs is a sport.",
    image: LIVE_IMAGES.participant8,
    createdAt: "1 month ago",
    likes: 44,
    comments: 5
  },
  {
    id: "p15",
    kind: "standard",
    category: "pump_check",
    caption: "Joined a live cardio room at midnight. Worth it.",
    image: LIVE_IMAGES.participant6,
    createdAt: "1 month ago",
    likes: 35,
    comments: 6
  }
];

type ProfileComment = {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  text: string;
};

function seedProfileComments(post: SelfPost): ProfileComment[] {
  const count = Math.min(post.comments, 2);
  if (count === 0) return [];

  return [
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
  ].slice(0, count);
}

function ProfilePostModal({
  post,
  onClose,
  onCommentCountChange,
  displayName,
  handle,
  avatarSrc
}: {
  post: SelfPost;
  onClose: () => void;
  onCommentCountChange: (postId: string, count: number) => void;
  displayName: string;
  handle: string;
  avatarSrc: string;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<ProfileComment[]>(() =>
    seedProfileComments(post)
  );

  const commentCount = Math.max(post.comments, comments.length);

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

  const sendComment = () => {
    const text = draft.trim();
    if (!text) return;
    const next = [
      ...comments,
      {
        id: `local-${Date.now()}`,
        author: displayName,
        handle,
        avatar: avatarSrc,
        text
      }
    ];
    setComments(next);
    setDraft("");
    onCommentCountChange(post.id, Math.max(post.comments, next.length));
  };

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
        aria-label="Your post"
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
          {post.kind === "transform" &&
          post.beforeImage &&
          post.afterImage ? (
            <div className="feed-post-transform">
              <div className="feed-post-transform-half">
                <Image
                  alt="Before"
                  className="feed-post-image"
                  fill
                  priority
                  sizes="(max-width: 900px) 50vw, 320px"
                  src={post.beforeImage}
                  unoptimized={post.beforeImage.startsWith("blob:")}
                />
                <span className="feed-post-transform-label">Before</span>
              </div>
              <div className="feed-post-transform-half">
                <Image
                  alt="After"
                  className="feed-post-image"
                  fill
                  priority
                  sizes="(max-width: 900px) 50vw, 320px"
                  src={post.afterImage}
                  unoptimized={post.afterImage.startsWith("blob:")}
                />
                <span className="feed-post-transform-label">After</span>
              </div>
            </div>
          ) : post.image ? (
            <div className="feed-post-media feed-post-media--portrait">
              <Image
                alt=""
                className="feed-post-image"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 640px"
                src={post.image}
                unoptimized={post.image.startsWith("blob:")}
              />
            </div>
          ) : (
            <div className="feed-post-quote">
              <span className="feed-post-quote-mark" aria-hidden>
                “
              </span>
              <p>{post.caption}</p>
            </div>
          )}
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
                  src={avatarSrc}
                  unoptimized={avatarSrc.startsWith("blob:")}
                />
              </div>
              <div>
                <p className="feed-post-author">{displayName}</p>
                <p className="feed-post-handle">
                  {handle} · {post.createdAt}
                </p>
              </div>
            </div>

            <p className="feed-post-category-pill">
              {categoryLabel(post.category)}
            </p>
            <p className="feed-post-caption">{post.caption}</p>
            {post.location || (post.tags && post.tags.length > 0) ? (
              <div className="feed-post-extras">
                {post.location ? (
                  <p className="feed-post-location">
                    <span aria-hidden>📍</span> {post.location}
                  </p>
                ) : null}
                {post.tags && post.tags.length > 0 ? (
                  <div className="feed-post-tags">
                    {post.tags.map((tag) => (
                      <span className="feed-post-tag" key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="feed-post-actions">
              <button
                type="button"
                className={`feed-post-action feed-post-like${liked ? " is-liked" : ""}`}
                aria-label={liked ? "Unlike" : "Like"}
                aria-pressed={liked}
                onClick={() => {
                  setLiked((value) => !value);
                  setLikeCount((count) => count + (liked ? -1 : 1));
                }}
              >
                <span aria-hidden>{liked ? "♥" : "♡"}</span> {likeCount}
              </button>
              <span className="feed-post-action feed-post-comment is-open">
                <span aria-hidden>💬</span> {commentCount}
              </span>
            </div>
          </div>

          <div className="feed-post-comments feed-post-comments--modal">
            <div className="feed-post-comments-scroll">
              {comments.length > 0 ? (
                <ul className="feed-post-comment-list">
                  {comments.map((comment) => (
                    <li className="feed-post-comment" key={comment.id}>
                      <span className="feed-post-comment-avatar">
                        <Image
                          alt=""
                          className="feed-post-avatar-image"
                          fill
                          sizes="32px"
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
                <p className="feed-post-comments-empty">Be the first to comment.</p>
              )}
            </div>
            <form
              className="feed-post-comment-composer"
              onSubmit={(event) => {
                event.preventDefault();
                sendComment();
              }}
            >
              <label className="sr-only" htmlFor={`profile-comment-${post.id}`}>
                Write a comment
              </label>
              <input
                id={`profile-comment-${post.id}`}
                className="feed-post-comment-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a comment…"
              />
              <button
                type="submit"
                className="feed-post-comment-send"
                disabled={!draft.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

const POSTS_PAGE_SIZE = 9;

function mapGoalsToCards(goals: DbGoal[]): ProfileGoalCard[] {
  return goals
    .filter((goal) => goal.template_id !== "hours_worked")
    .map((goal) => ({
      id: goal.id,
      title: goal.title,
      progress: resolveGoalProgress(goal),
      detail: formatGoalDetail(goal)
    }));
}

function formatHours(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

export function ProfilePage({
  initialData = null
}: {
  initialData?: ProfileViewModel | null;
}) {
  const identityRef = useRef<HTMLElement>(null);
  const identityBodyRef = useRef<HTMLDivElement>(null);
  const goalsPanelRef = useRef<HTMLElement>(null);
  const [posts, setPosts] = useState<SelfPost[]>(INITIAL_POSTS);
  const [profileData, setProfileData] = useState<ProfileViewModel | null>(
    initialData
  );
  const [goals, setGoals] = useState<ProfileGoalCard[]>(() =>
    initialData ? mapGoalsToCards(initialData.goals) : INITIAL_GOALS
  );
  const [visiblePostCount, setVisiblePostCount] = useState(POSTS_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadPreview, setUploadPreview] =
    useState<ComposerPublishPayload | null>(null);
  const uploadPreviewRef = useRef<ComposerPublishPayload | null>(null);
  uploadPreviewRef.current = uploadPreview;

  useEffect(() => {
    setProfileData(initialData);
    if (initialData) {
      setGoals(mapGoalsToCards(initialData.goals));
    }
  }, [initialData]);

  useEffect(() => {
    if (initialData) return;

    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const [{ data: profile }, { data: goalRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true })
      ]);

      if (!profile || cancelled) return;

      const typedGoals = (goalRows ?? []) as DbGoal[];
      const hoursGoalRow = typedGoals.find((g) => g.template_id === "hours_worked");
      const streakGoal = typedGoals.find((g) => g.template_id === "mobility_streak");
      const hoursWorked = Number(hoursGoalRow?.current_value ?? 0);
      const hoursGoal = Number(hoursGoalRow?.target_value ?? 50);
      const view: ProfileViewModel = {
        profile: profile as ProfileViewModel["profile"],
        goals: typedGoals,
        hoursWorked,
        hoursGoal,
        hoursProgress: resolveGoalProgress(
          hoursGoalRow ?? {
            id: "hours",
            user_id: user.id,
            template_id: "hours_worked",
            title: "Hours worked",
            detail: null,
            category: "consistency",
            current_value: hoursWorked,
            target_value: hoursGoal,
            unit: "hours",
            progress: 0,
            sort_order: 0,
            created_at: "",
            updated_at: ""
          }
        ),
        dayStreak: Math.round(Number(streakGoal?.current_value ?? 0))
      };

      setProfileData(view);
      setGoals(mapGoalsToCards(typedGoals));
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  const displayName = profileData?.profile.display_name?.trim() || "You";
  const handle = profileData?.profile.username
    ? `@${profileData.profile.username}`
    : "@you";
  const bio =
    profileData?.profile.bio?.trim() ||
    "Building strength one session at a time. Yoga · Cardio · Accountability.";
  const avatarSrc =
    profileData?.profile.avatar_url?.trim() || LIVE_IMAGES.participant4;
  const hoursWorked = profileData?.hoursWorked ?? 0;
  const hoursGoal = profileData?.hoursGoal ?? 50;
  const hoursProgress = profileData?.hoursProgress ?? 0;
  const dayStreak = profileData?.dayStreak ?? 0;

  useEffect(() => {
    const identity = identityRef.current;
    const identityBody = identityBodyRef.current;
    const goalsPanel = goalsPanelRef.current;
    if (!identity || !identityBody) return;

    const syncHeight = () => {
      if (window.matchMedia("(max-width: 960px)").matches) {
        identity.style.height = "";
        if (goalsPanel) goalsPanel.style.height = "";
        return;
      }

      identity.style.height = "auto";
      if (goalsPanel) goalsPanel.style.height = "auto";
      const bodyHeight = identityBody.getBoundingClientRect().height;
      const totalHeight = bodyHeight / 0.9;
      identity.style.height = `${totalHeight}px`;
      if (goalsPanel) goalsPanel.style.height = `${totalHeight}px`;
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(identityBody);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, [displayName, bio, handle, avatarSrc, hoursWorked, hoursGoal, dayStreak, goals]);

  const visiblePosts = useMemo(
    () => posts.slice(0, visiblePostCount),
    [posts, visiblePostCount]
  );
  const hasMorePosts = visiblePostCount < posts.length;
  const activePost = posts.find((post) => post.id === activePostId) ?? null;

  const loadMorePosts = () => {
    if (!hasMorePosts || isLoadingMore) return;
    setIsLoadingMore(true);
    window.setTimeout(() => {
      setVisiblePostCount((count) =>
        Math.min(count + POSTS_PAGE_SIZE, posts.length)
      );
      setIsLoadingMore(false);
    }, 350);
  };

  const publish = (payload: ComposerPublishPayload) => {
    setUploadPreview(payload);
  };

  const finishUpload = useCallback(() => {
    const current = uploadPreviewRef.current;
    if (!current) return;
    setUploadPreview(null);
    setPosts((prev) => [
      {
        id: `local-${Date.now()}`,
        ...current,
        createdAt: "Just now",
        likes: 0,
        comments: 0
      },
      ...prev
    ]);
    setVisiblePostCount((count) => Math.max(count, POSTS_PAGE_SIZE));
  }, []);

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <aside className="profile-identity" ref={identityRef}>
          <div className="profile-identity-body" ref={identityBodyRef}>
          <div className="profile-identity-top">
            <div className="profile-avatar">
              <Image
                alt=""
                className="profile-avatar-image"
                fill
                sizes="160px"
                src={avatarSrc}
                priority
                unoptimized={
                  avatarSrc.startsWith("blob:") ||
                  avatarSrc.includes("supabase.co")
                }
              />
            </div>
            <div className="profile-identity-metrics">
              <div className="profile-buddies">
                <span className="profile-buddies-decor" aria-hidden>
                  <svg viewBox="0 0 32 32" fill="none">
                    <path
                      d="M16 7v6M13 10h6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9 18c3.2-3.8 7.2-4.6 11.5-2.2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M22.5 21.2c.9-.15 1.55.55 1.35 1.4-.25 1.05-1.45 1.7-2.4 1.25-.7-.35-.85-1.25-.35-1.8.3-.35.8-.55 1.4-.55Z"
                      fill="currentColor"
                    />
                    <circle cx="22.2" cy="21.6" r="0.9" fill="currentColor" opacity="0.35" />
                  </svg>
                </span>
                <div className="profile-buddies-top">
                  <span className="profile-buddies-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 11a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 9 11Zm6.5 0a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <path
                        d="M3.75 18.25c0-2.7 2.15-4.9 4.8-4.9h1.1c1.35 0 2.55.6 3.35 1.5.75-.85 1.85-1.4 3.1-1.4h.7c2.5 0 4.55 2.05 4.55 4.55v.25H3.75v-.25Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <strong className="profile-buddies-count">0</strong>
                </div>
                <span className="profile-buddies-label">Workout Buddies</span>
                <span className="profile-buddies-badge">Invite friends</span>
              </div>

              <div className="profile-hours">
                <div className="profile-hours-top">
                  <strong className="profile-hours-value">
                    {formatHours(hoursWorked)} hrs
                  </strong>
                  <span className="profile-hours-goal">/ {Math.round(hoursGoal)}</span>
                </div>
                <div
                  className="profile-hours-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(hoursGoal)}
                  aria-valuenow={Math.round(hoursWorked)}
                  aria-label="Hours worked progress"
                >
                  <span
                    className="profile-hours-fill"
                    style={{ width: `${hoursProgress}%` }}
                  />
                </div>
                <div className="profile-hours-label">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle
                      cx="12"
                      cy="12"
                      r="8.25"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M12 8v4.25l2.75 1.75"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Hours Worked
                </div>
              </div>
            </div>
          </div>
          <div className="profile-identity-copy">
            <div className="profile-identity-copy-head">
              <div>
                <h1>{displayName}</h1>
                <p className="profile-handle">{handle}</p>
              </div>
              <button
                type="button"
                className="btn-secondary profile-edit-trigger"
                onClick={() => setEditOpen(true)}
                disabled={!profileData}
              >
                Edit
              </button>
            </div>
            <p className="profile-bio">{bio}</p>
          </div>
          </div>
            <div className="profile-stats">
              <span className="profile-stat">
                <span className="profile-stat-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7.5 4.75h9A2.75 2.75 0 0 1 19.25 7.5v9A2.75 2.75 0 0 1 16.5 19.25h-9A2.75 2.75 0 0 1 4.75 16.5v-9A2.75 2.75 0 0 1 7.5 4.75Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M9.5 14.5 14.5 9.5M11 9.5h3.5V13"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <strong>{posts.length}</strong>
                <span className="profile-stat-label">posts</span>
              </span>
              <span className="profile-stat">
                <span className="profile-stat-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 11a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 9 11Zm6.5 0a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M3.75 18.25c0-2.7 2.15-4.9 4.8-4.9h1.1c1.35 0 2.55.6 3.35 1.5.75-.85 1.85-1.4 3.1-1.4h.7c2.5 0 4.55 2.05 4.55 4.55v.25H3.75v-.25Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <strong>0</strong>
                <span className="profile-stat-label">rooms joined</span>
              </span>
              <span className="profile-stat">
                <span className="profile-stat-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7.5 4.75h9A2.75 2.75 0 0 1 19.25 7.5v9A2.75 2.75 0 0 1 16.5 19.25h-9A2.75 2.75 0 0 1 4.75 16.5v-9A2.75 2.75 0 0 1 7.5 4.75Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M8.25 9.25h7.5M8.25 12.25h7.5M8.25 15.25h4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="m13.75 14.1 1.35 1.35 2.4-2.55"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <strong>{dayStreak}</strong>
                <span className="profile-stat-label">day streak</span>
              </span>
            </div>
        </aside>

        <aside className="profile-goals-panel" ref={goalsPanelRef}>
          <div className="profile-goals">
            {goals.length > 0 ? (
              goals.map((goal) => (
                <article className="profile-goal-card" key={goal.id}>
                  <div className="profile-goal-top">
                    <strong>{goal.title}</strong>
                    <span className="profile-goal-detail">{goal.detail}</span>
                    <span className="profile-goal-pct">{goal.progress}%</span>
                  </div>
                  <div className="profile-goal-track" aria-hidden>
                    <span
                      className="profile-goal-fill"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </article>
              ))
            ) : (
              <p className="profile-goals-empty">
                No goals yet. Add some from Edit on your profile.
              </p>
            )}
          </div>
        </aside>
      </section>

      <ProfileComposer onPublish={publish} />

      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Your posts</h2>
          <span>{posts.length} updates</span>
        </div>
        <div className="profile-posts">
          {visiblePosts.map((post) => {
            const cover =
              post.kind === "transform"
                ? post.afterImage ?? post.beforeImage
                : post.image;

            return (
              <button
                type="button"
                className="profile-post-card"
                key={post.id}
                onClick={() => setActivePostId(post.id)}
              >
                {cover ? (
                  <div
                    className={`profile-post-media${
                      post.kind === "transform"
                        ? " profile-post-media--transform"
                        : ""
                    }`}
                  >
                    {post.kind === "transform" &&
                    post.beforeImage &&
                    post.afterImage ? (
                      <div className="profile-post-transform">
                        <div className="profile-post-transform-half">
                          <Image
                            alt=""
                            className="profile-post-image"
                            fill
                            sizes="80px"
                            src={post.beforeImage}
                            unoptimized={post.beforeImage.startsWith("blob:")}
                          />
                        </div>
                        <div className="profile-post-transform-half">
                          <Image
                            alt=""
                            className="profile-post-image"
                            fill
                            sizes="80px"
                            src={post.afterImage}
                            unoptimized={post.afterImage.startsWith("blob:")}
                          />
                        </div>
                      </div>
                    ) : (
                      <Image
                        alt=""
                        className="profile-post-image"
                        fill
                        sizes="160px"
                        src={cover}
                        unoptimized={cover.startsWith("blob:")}
                      />
                    )}
                  </div>
                ) : (
                  <div className="profile-post-media profile-post-media--quote">
                    <p>{post.caption}</p>
                  </div>
                )}
                <div className="profile-post-body">
                  <p className="profile-post-category">
                    {categoryLabel(post.category)}
                  </p>
                  <p className="profile-post-caption">{post.caption}</p>
                  {post.location || (post.tags && post.tags.length > 0) ? (
                    <p className="profile-post-extras">
                      {post.location ? <span>📍 {post.location}</span> : null}
                      {post.tags?.slice(0, 2).map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </p>
                  ) : null}
                  <div className="profile-post-meta">
                    <span>{post.createdAt}</span>
                    <span>♥ {post.likes}</span>
                    <span>💬 {post.comments}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="feed-load-more">
          {hasMorePosts ? (
            <button
              type="button"
              className="feed-load-more-btn"
              onClick={loadMorePosts}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </button>
          ) : (
            <p className="feed-load-more-done">You’re all caught up</p>
          )}
        </div>
      </section>

      {uploadPreview ? (
        <PostUploadPreview
          payload={uploadPreview}
          author={displayName}
          handle={handle}
          avatarSrc={avatarSrc}
          onComplete={finishUpload}
        />
      ) : null}

      {activePost ? (
        <ProfilePostModal
          post={activePost}
          displayName={displayName}
          handle={handle}
          avatarSrc={avatarSrc}
          onClose={() => setActivePostId(null)}
          onCommentCountChange={(postId, count) => {
            setPosts((prev) =>
              prev.map((item) =>
                item.id === postId ? { ...item, comments: count } : item
              )
            );
          }}
        />
      ) : null}

      {profileData ? (
        <ProfileEditDrawer
          open={editOpen}
          profile={profileData.profile}
          goals={profileData.goals}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => {
            setProfileData(next);
            setGoals(mapGoalsToCards(next.goals));
          }}
        />
      ) : null}
    </div>
  );
}
