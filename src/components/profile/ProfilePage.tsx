"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { MotivationQuoteCard } from "@/components/MotivationQuoteCard";
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
import { categoryLabel, CAPTION_MAX_LENGTH, type PostCategory, type PostKind } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";
import { createPost, deletePost, listUserPosts, updatePostCaption } from "@/lib/posts-api";
import type { DbPost } from "@/lib/types/post";
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

function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Just now";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) return `${Math.max(1, Math.round(diffSec / 60))}m ago`;
  if (diffSec < 86400) return `${Math.max(1, Math.round(diffSec / 3600))}h ago`;
  if (diffSec < 86400 * 7) {
    return `${Math.max(1, Math.round(diffSec / 86400))}d ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function mapDbPost(post: DbPost): SelfPost {
  return {
    id: post.id,
    kind: post.kind,
    category: post.category,
    caption: post.caption,
    image: post.image_url ?? undefined,
    beforeImage: post.before_image_url ?? undefined,
    afterImage: post.after_image_url ?? undefined,
    location: post.location ?? undefined,
    tags: post.tags?.length ? post.tags : undefined,
    createdAt: formatRelativeTime(post.created_at),
    likes: post.likes_count,
    comments: post.comments_count
  };
}

function revokePreviewUrls(payload: ComposerPublishPayload) {
  for (const url of [payload.image, payload.beforeImage, payload.afterImage]) {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  }
}

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

function ProfilePostCard({
  post,
  onOpen,
  onEdit,
  onDelete
}: {
  post: SelfPost;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isMotivation = post.category === "motivation";
  const cover = isMotivation
    ? undefined
    : post.kind === "transform"
      ? post.afterImage ?? post.beforeImage
      : post.image;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <article className="profile-post-card">
      <button
        type="button"
        className="profile-post-card-main"
        onClick={onOpen}
      >
        {cover ? (
          <div
            className={`profile-post-media${
              post.kind === "transform" ? " profile-post-media--transform" : ""
            }`}
          >
            {post.kind === "transform" &&
            post.beforeImage &&
            post.afterImage ? (
              <BeforeAfterSlider
                afterSrc={post.afterImage}
                beforeSrc={post.beforeImage}
                className="before-after-slider--thumb"
              />
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
            <span className="profile-post-quote-mark" aria-hidden>
              “
            </span>
            <p>{post.caption}</p>
          </div>
        )}
        <div className="profile-post-body">
          <p className="profile-post-category">
            {categoryLabel(post.category)}
          </p>
          {!isMotivation ? (
            <p className="profile-post-caption">{post.caption}</p>
          ) : null}
          {post.location || (post.tags && post.tags.length > 0) ? (
            <p className="profile-post-extras">
              {post.location ? <span>📍 {post.location}</span> : null}
              {post.tags?.slice(0, 2).map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </p>
          ) : null}
        </div>
      </button>

      <div className="profile-post-footer">
        <button
          type="button"
          className="profile-post-meta"
          onClick={onOpen}
        >
          <span>{post.createdAt}</span>
          <span>♥ {post.likes}</span>
          <span>💬 {post.comments}</span>
        </button>

        <div className="profile-post-menu" ref={menuRef}>
          <button
            type="button"
            className="profile-post-menu-trigger"
            aria-label="Post options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            <span aria-hidden>⋮</span>
          </button>
          {menuOpen ? (
            <div className="profile-post-menu-dropdown" role="menu">
              <button
                type="button"
                role="menuitem"
                className="profile-post-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              >
                Edit caption
              </button>
              <button
                type="button"
                role="menuitem"
                className="profile-post-menu-item profile-post-menu-item--danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ConfirmDeleteModal({
  busy,
  error,
  onCancel,
  onConfirm
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onCancel]);

  return (
    <div
      className="confirm-delete-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="confirm-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-delete-title">Delete this post?</h3>
        <p id="confirm-delete-desc">
          This cannot be undone. The post and its photos will be removed from
          your profile.
        </p>
        {error ? <p className="confirm-delete-error">{error}</p> : null}
        <div className="confirm-delete-actions">
          <button
            type="button"
            className="confirm-delete-btn confirm-delete-btn--ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-delete-btn confirm-delete-btn--danger"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfilePostModal({
  post,
  onClose,
  onCommentCountChange,
  onCaptionUpdated,
  onRequestDelete,
  displayName,
  handle,
  avatarSrc,
  initialEditing = false,
  blockClose = false
}: {
  post: SelfPost;
  onClose: () => void;
  onCommentCountChange: (postId: string, count: number) => void;
  onCaptionUpdated: (postId: string, caption: string) => void;
  onRequestDelete: () => void;
  displayName: string;
  handle: string;
  avatarSrc: string;
  initialEditing?: boolean;
  blockClose?: boolean;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<ProfileComment[]>(() =>
    seedProfileComments(post)
  );
  const [editing, setEditing] = useState(initialEditing);
  const [captionDraft, setCaptionDraft] = useState(post.caption);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const commentCount = Math.max(post.comments, comments.length);
  const displayCaption = editing ? captionDraft : post.caption;

  useEffect(() => {
    setCaptionDraft(post.caption);
    setEditing(initialEditing);
    setActionError(null);
  }, [post.id, initialEditing]);

  useEffect(() => {
    if (!editing) setCaptionDraft(post.caption);
  }, [post.caption, editing]);

  useEffect(() => {
    if (blockClose) return;
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
  }, [onClose, blockClose]);

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

  const saveCaption = async () => {
    const next = captionDraft.trim();
    if (!next || next === post.caption) {
      setEditing(false);
      setCaptionDraft(post.caption);
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const supabase = createClient();
      await updatePostCaption(supabase, post.id, next);
      onCaptionUpdated(post.id, next);
      setEditing(false);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not save caption."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="feed-post-modal-backdrop"
      onClick={() => {
        if (!blockClose) onClose();
      }}
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
          disabled={blockClose}
          onClick={() => {
            if (!blockClose) onClose();
          }}
        >
          ×
        </button>

        <div className="feed-post-modal-media">
          {post.kind === "transform" &&
          post.beforeImage &&
          post.afterImage ? (
            <BeforeAfterSlider
              afterSrc={post.afterImage}
              beforeSrc={post.beforeImage}
              className="before-after-slider--modal"
            />
          ) : post.category === "motivation" ? (
            <MotivationQuoteCard text={displayCaption} />
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
            <MotivationQuoteCard text={displayCaption} />
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

            {editing ? (
              <div className="feed-post-edit">
                <textarea
                  className="feed-post-edit-input"
                  value={captionDraft}
                  maxLength={CAPTION_MAX_LENGTH}
                  rows={4}
                  onChange={(event) => setCaptionDraft(event.target.value)}
                />
                <div className="feed-post-edit-meta">
                  <span>
                    {captionDraft.length}/{CAPTION_MAX_LENGTH}
                  </span>
                  <div className="feed-post-edit-actions">
                    <button
                      type="button"
                      className="feed-post-manage-btn"
                      disabled={saving}
                      onClick={() => {
                        setEditing(false);
                        setCaptionDraft(post.caption);
                        setActionError(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="feed-post-manage-btn feed-post-manage-btn--primary"
                      disabled={saving || !captionDraft.trim()}
                      onClick={() => void saveCaption()}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            ) : post.category !== "motivation" ? (
              <p className="feed-post-caption">{post.caption}</p>
            ) : null}

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

            <div className="feed-post-manage">
              {!editing ? (
                <button
                  type="button"
                  className="feed-post-manage-btn"
                  onClick={() => setEditing(true)}
                >
                  Edit caption
                </button>
              ) : null}
              <button
                type="button"
                className="feed-post-manage-btn feed-post-manage-btn--danger"
                onClick={onRequestDelete}
              >
                Delete post
              </button>
            </div>

            {actionError ? (
              <p className="feed-post-manage-error">{actionError}</p>
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
  const [posts, setPosts] = useState<SelfPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileViewModel | null>(
    initialData
  );
  const [goals, setGoals] = useState<ProfileGoalCard[]>(() =>
    initialData ? mapGoalsToCards(initialData.goals) : INITIAL_GOALS
  );
  const [visiblePostCount, setVisiblePostCount] = useState(POSTS_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [editOnOpen, setEditOnOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadPreview, setUploadPreview] =
    useState<ComposerPublishPayload | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setProfileData(initialData);
    if (initialData) {
      setGoals(mapGoalsToCards(initialData.goals));
    }
  }, [initialData]);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      setPostsLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setPosts([]);
            setPostsLoading(false);
          }
          return;
        }

        const rows = await listUserPosts(supabase, user.id);
        if (cancelled) return;
        setPosts(rows.map(mapDbPost));
        setVisiblePostCount(POSTS_PAGE_SIZE);
      } catch (error) {
        console.error(error);
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    };

    void loadPosts();
    return () => {
      cancelled = true;
    };
  }, [initialData?.profile.id]);

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

  const openPost = (postId: string, edit = false) => {
    setEditOnOpen(edit);
    setActivePostId(postId);
  };

  const closePost = () => {
    setActivePostId(null);
    setEditOnOpen(false);
  };

  const requestDeletePost = (postId: string) => {
    setDeleteError(null);
    setPendingDeleteId(postId);
  };

  const cancelDeletePost = () => {
    if (deleteBusy) return;
    setPendingDeleteId(null);
    setDeleteError(null);
  };

  const confirmDeletePost = async () => {
    if (!pendingDeleteId) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const supabase = createClient();
      await deletePost(supabase, pendingDeleteId);
      setPosts((prev) => prev.filter((item) => item.id !== pendingDeleteId));
      if (activePostId === pendingDeleteId) closePost();
      setPendingDeleteId(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete post."
      );
    } finally {
      setDeleteBusy(false);
    }
  };

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
    setUploadError(null);
    setUploadProgress(0);
    setUploadPreview(payload);
  };

  useEffect(() => {
    if (!uploadPreview) return;

    let cancelled = false;

    const run = async () => {
      setUploadError(null);
      setUploadProgress(0);
      try {
        const supabase = createClient();
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("You must be signed in to post.");
        }

        const created = await createPost(
          supabase,
          user.id,
          {
            kind: uploadPreview.kind,
            category: uploadPreview.category,
            caption: uploadPreview.caption,
            location: uploadPreview.location,
            tags: uploadPreview.tags,
            imageFile: uploadPreview.imageFile,
            beforeFile: uploadPreview.beforeFile,
            afterFile: uploadPreview.afterFile
          },
          (value) => {
            if (!cancelled) setUploadProgress(value);
          }
        );

        if (cancelled) return;

        revokePreviewUrls(uploadPreview);
        setPosts((prev) => [mapDbPost(created), ...prev]);
        setVisiblePostCount((count) => Math.max(count, POSTS_PAGE_SIZE));
        setUploadPreview(null);
        setUploadProgress(0);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Could not publish post.";
        setUploadError(message);
        setUploadProgress(0);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [uploadPreview]);

  const dismissUpload = () => {
    if (uploadPreview) revokePreviewUrls(uploadPreview);
    setUploadPreview(null);
    setUploadError(null);
    setUploadProgress(0);
  };

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

      <ProfileComposer
        onPublish={publish}
        author={displayName}
        handle={handle}
        avatarSrc={avatarSrc}
      />

      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Your posts</h2>
          <span>
            {postsLoading
              ? "Loading…"
              : `${posts.length} update${posts.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="profile-posts">
          {!postsLoading && posts.length === 0 ? (
            <p className="profile-posts-empty">
              No posts yet. Share your first update above.
            </p>
          ) : null}
          {visiblePosts.map((post) => (
            <ProfilePostCard
              key={post.id}
              post={post}
              onOpen={() => openPost(post.id)}
              onEdit={() => openPost(post.id, true)}
              onDelete={() => requestDeletePost(post.id)}
            />
          ))}
        </div>

        <div className="feed-load-more">
          {postsLoading ? null : hasMorePosts ? (
            <button
              type="button"
              className="feed-load-more-btn"
              onClick={loadMorePosts}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </button>
          ) : posts.length > 0 ? (
            <p className="feed-load-more-done">You’re all caught up</p>
          ) : null}
        </div>
      </section>

      {uploadPreview ? (
        <PostUploadPreview
          payload={uploadPreview}
          author={displayName}
          handle={handle}
          avatarSrc={avatarSrc}
          progress={uploadProgress}
          error={uploadError}
          onDismissError={dismissUpload}
        />
      ) : null}

      {activePost ? (
        <ProfilePostModal
          post={activePost}
          displayName={displayName}
          handle={handle}
          avatarSrc={avatarSrc}
          initialEditing={editOnOpen}
          blockClose={Boolean(pendingDeleteId)}
          onClose={closePost}
          onCommentCountChange={(postId, count) => {
            setPosts((prev) =>
              prev.map((item) =>
                item.id === postId ? { ...item, comments: count } : item
              )
            );
          }}
          onCaptionUpdated={(postId, caption) => {
            setPosts((prev) =>
              prev.map((item) =>
                item.id === postId ? { ...item, caption } : item
              )
            );
          }}
          onRequestDelete={() => requestDeletePost(activePost.id)}
        />
      ) : null}

      {pendingDeleteId ? (
        <ConfirmDeleteModal
          busy={deleteBusy}
          error={deleteError}
          onCancel={cancelDeletePost}
          onConfirm={() => void confirmDeletePost()}
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
