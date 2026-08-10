"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  exerciseNamesFromPlan,
  LobbyChatComposer
} from "@/components/live/LobbyChatComposer";
import { LobbyWorkoutLogCard } from "@/components/live/LobbyWorkoutLogCard";
import { formatDurationClock } from "@/lib/lobby-chat-api";
import { createClient } from "@/lib/supabase/client";
import type { LobbyMessageView } from "@/lib/types/lobby-chat";
import type { WorkoutLogView } from "@/lib/types/workout-log";
import { WORKOUT_LOGS_PAGE_SIZE } from "@/lib/types/workout-log";
import type { WorkoutPlan } from "@/lib/workout-plan";
import {
  createWorkoutLogComment,
  listUserWorkoutLogs,
  listWorkoutLogComments,
  toggleWorkoutLogLike
} from "@/lib/workout-log-api";
import {
  buildWeekDaySlots,
  startOfWeekMonday
} from "@/lib/weekly-plan-calendar";

type ProfileLogItem = {
  id: string;
  exerciseName: string;
  set: number | null;
  reps: string | null;
  weight: string | null;
  durationSeconds: number | null;
  planDayIndex: number | null;
  loggedOn: string;
  createdAt: string;
  createdAtIso: string;
  likes: number;
  comments: number;
  likedByMe: boolean;
};

type ProfileComment = {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  text: string;
};

type AuthorInfo = {
  displayName: string;
  handle: string;
  avatarSrc: string;
  userId: string;
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

function formatWeight(weight: string) {
  const trimmed = weight.trim();
  if (!trimmed) return trimmed;
  if (/\s/.test(trimmed) || /[a-zA-Z]/.test(trimmed)) return trimmed;
  return `${trimmed} kg`;
}

function mapLog(log: WorkoutLogView, likedByMe = false): ProfileLogItem {
  return {
    id: log.id,
    exerciseName: log.exerciseName,
    set: log.set,
    reps: log.reps,
    weight: log.weight,
    durationSeconds: log.durationSeconds,
    planDayIndex: log.planDayIndex,
    loggedOn: log.loggedOn,
    createdAt: formatRelativeTime(log.createdAt),
    createdAtIso: log.createdAt,
    likes: log.likesCount,
    comments: log.commentsCount,
    likedByMe
  };
}

function toLobbyMessage(
  log: ProfileLogItem,
  author: AuthorInfo
): LobbyMessageView {
  return {
    id: log.id,
    senderId: author.userId,
    author: author.displayName,
    handle: author.handle,
    avatar: author.avatarSrc,
    text: log.exerciseName,
    messageType: "workout_log",
    payload: {
      exerciseName: log.exerciseName,
      set: log.set,
      reps: log.reps,
      weight: log.weight,
      durationSeconds: log.durationSeconds,
      planDayIndex: log.planDayIndex,
      loggedOn: log.loggedOn
    },
    createdAt: log.createdAtIso
  };
}

function ProfileWorkoutLogCard({
  log,
  author,
  onOpen
}: {
  log: ProfileLogItem;
  author: AuthorInfo;
  onOpen: () => void;
}) {
  return (
    <article className="profile-workout-log-card">
      <button
        type="button"
        className="profile-workout-log-card-main"
        onClick={onOpen}
      >
        <LobbyWorkoutLogCard
          message={toLobbyMessage(log, author)}
          className="profile-workout-log"
        />
        <div className="profile-workout-log-card-meta">
          <span>{log.createdAt}</span>
          <span>♥ {log.likes}</span>
          <span>💬 {log.comments}</span>
        </div>
      </button>
    </article>
  );
}

function ProfileWorkoutLogModal({
  log,
  author,
  onClose,
  onStatsChange
}: {
  log: ProfileLogItem;
  author: AuthorInfo;
  onClose: () => void;
  onStatsChange: (
    logId: string,
    stats: { likes: number; comments: number; likedByMe: boolean }
  ) => void;
}) {
  const [liked, setLiked] = useState(log.likedByMe);
  const [likeCount, setLikeCount] = useState(log.likes);
  const [commentCount, setCommentCount] = useState(log.comments);
  const [likeBusy, setLikeBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<ProfileComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentBusy, setCommentBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setLiked(log.likedByMe);
    setLikeCount(log.likes);
    setCommentCount(log.comments);
    setActionError(null);
  }, [log.id, log.likedByMe, log.likes, log.comments]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCommentsLoading(true);
      try {
        const supabase = createClient();
        const rows = await listWorkoutLogComments(supabase, log.id);
        if (cancelled) return;
        setComments(
          rows.map((row) => ({
            id: row.id,
            author: row.author,
            handle: row.handle,
            avatar: row.avatar,
            text: row.body
          }))
        );
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
  }, [log.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggleLike = async () => {
    if (likeBusy) return;
    const previousLiked = liked;
    const previousCount = likeCount;
    setLiked(!previousLiked);
    setLikeCount(previousCount + (previousLiked ? -1 : 1));
    setLikeBusy(true);
    setActionError(null);
    try {
      const supabase = createClient();
      const result = await toggleWorkoutLogLike(
        supabase,
        log.id,
        previousLiked
      );
      setLiked(result.liked);
      setLikeCount(result.likesCount);
      onStatsChange(log.id, {
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

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || commentBusy) return;
    setCommentBusy(true);
    setActionError(null);
    try {
      const supabase = createClient();
      const result = await createWorkoutLogComment(supabase, log.id, text);
      setComments((prev) => [
        ...prev,
        {
          id: result.comment.id,
          author: result.comment.author,
          handle: result.comment.handle,
          avatar: result.comment.avatar,
          text: result.comment.body
        }
      ]);
      setDraft("");
      setCommentCount(result.commentsCount);
      onStatsChange(log.id, {
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

  const payload = toLobbyMessage(log, author).payload;

  return (
    <div
      className="feed-post-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="feed-post-modal profile-workout-log-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Workout log"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="feed-post-modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>

        <div className="profile-workout-log-modal-body">
          <div className="profile-workout-log-modal-card">
            <p className="profile-workout-log-eyebrow">Completed set</p>
            <strong className="profile-workout-log-name">
              {log.exerciseName}
            </strong>
            {payload &&
            (payload.set != null ||
              payload.weight ||
              payload.reps ||
              payload.durationSeconds != null) ? (
              <div className="profile-workout-log-stats">
                {payload.set != null || payload.weight ? (
                  <div className="profile-workout-log-stats-row">
                    <span>
                      {payload.set != null ? `Set ${payload.set}` : ""}
                    </span>
                    <span>
                      {payload.weight ? formatWeight(payload.weight) : ""}
                    </span>
                  </div>
                ) : null}
                {payload.reps || payload.durationSeconds != null ? (
                  <div className="profile-workout-log-stats-row">
                    <span>{payload.reps ? `${payload.reps} reps` : ""}</span>
                    <span>
                      {payload.durationSeconds != null
                        ? `⏱ ${formatDurationClock(payload.durationSeconds)}`
                        : ""}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="profile-workout-log-when">{log.createdAt}</p>
          </div>

          <div className="feed-post-actions">
            <button
              type="button"
              className={`feed-post-action feed-post-like${liked ? " is-liked" : ""}`}
              aria-label={liked ? "Unlike" : "Like"}
              aria-pressed={liked}
              disabled={likeBusy}
              onClick={() => void toggleLike()}
            >
              <span aria-hidden>{liked ? "♥" : "♡"}</span> {likeCount}
            </button>
            <span className="feed-post-action feed-post-comment is-open">
              <span aria-hidden>💬</span> {commentCount}
            </span>
          </div>

          {actionError ? (
            <p className="feed-post-manage-error">{actionError}</p>
          ) : null}

          <div className="feed-post-comments feed-post-comments--modal">
            <div className="feed-post-comments-scroll">
              {commentsLoading ? (
                <p className="feed-post-comments-empty">Loading comments…</p>
              ) : comments.length > 0 ? (
                <ul className="feed-post-comment-list">
                  {comments.map((comment) => (
                    <li className="feed-post-comment" key={comment.id}>
                      <span className="feed-post-comment-avatar">
                        <Image
                          alt=""
                          width={28}
                          height={28}
                          src={comment.avatar}
                          unoptimized={
                            comment.avatar.startsWith("http") ||
                            comment.avatar.startsWith("blob:")
                          }
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
                <p className="feed-post-comments-empty">
                  Be the first to comment.
                </p>
              )}
            </div>
            <form
              className="feed-post-comment-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void submitComment();
              }}
            >
              <label
                className="sr-only"
                htmlFor={`profile-log-comment-${log.id}`}
              >
                Write a comment
              </label>
              <input
                id={`profile-log-comment-${log.id}`}
                className="feed-post-comment-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a comment…"
                disabled={commentBusy}
                maxLength={500}
              />
              <button
                type="submit"
                className="feed-post-comment-send"
                disabled={!draft.trim() || commentBusy}
              >
                {commentBusy ? "…" : "Send"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileWorkoutLogComposer({
  workoutPlan,
  onCreated
}: {
  workoutPlan: WorkoutPlan | null;
  onCreated: (log: ProfileLogItem) => void;
}) {
  const planDayIndex = useMemo(() => {
    if (!workoutPlan) return null;
    return (
      buildWeekDaySlots(workoutPlan, startOfWeekMonday(new Date())).find(
        (slot) => slot.isToday
      )?.sessionIndex ?? null
    );
  }, [workoutPlan]);

  const exerciseOptions = useMemo(
    () => exerciseNamesFromPlan(workoutPlan, planDayIndex),
    [workoutPlan, planDayIndex]
  );

  return (
    <div className="profile-composer profile-workout-composer">
      <div className="profile-compose-main">
        <h2>Share a workout log</h2>
        <LobbyChatComposer
          onSendWorkoutLog={(message, log) => {
            if (log) {
              onCreated(mapLog(log, false));
              return;
            }
            const payload = message.payload;
            if (!payload) return;
            // Fallback if API shape is older — still show the set locally.
            onCreated({
              id: message.id,
              exerciseName: payload.exerciseName,
              set: payload.set,
              reps: payload.reps,
              weight: payload.weight,
              durationSeconds: payload.durationSeconds,
              planDayIndex: payload.planDayIndex,
              loggedOn: payload.loggedOn,
              createdAt: formatRelativeTime(message.createdAt),
              createdAtIso: message.createdAt,
              likes: 0,
              comments: 0,
              likedByMe: false
            });
          }}
          disabled={false}
          exerciseOptions={exerciseOptions}
          planDayIndex={planDayIndex}
          inputId="profile-workout-log-input"
          classPrefix="profile-workout"
        />
        <p className="profile-workout-composer-note">
          Sets also appear in the Rooms lobby chat.
        </p>
      </div>
    </div>
  );
}

export function ProfileWorkoutLogsSection({
  ownerId,
  displayName,
  handle,
  avatarSrc,
  readOnly,
  workoutPlan,
  showComposer
}: {
  ownerId: string;
  displayName: string;
  handle: string;
  avatarSrc: string;
  readOnly: boolean;
  workoutPlan: WorkoutPlan | null;
  showComposer: boolean;
}) {
  const [logs, setLogs] = useState<ProfileLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);

  const author = useMemo<AuthorInfo>(
    () => ({ displayName, handle, avatarSrc, userId: ownerId }),
    [displayName, handle, avatarSrc, ownerId]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const page = await listUserWorkoutLogs(supabase, ownerId, {
          limit: WORKOUT_LOGS_PAGE_SIZE
        });
        if (cancelled) return;
        const liked = new Set(page.likedLogIds);
        setLogs(page.logs.map((row) => mapLog(row, liked.has(row.id))));
        setHasMore(page.hasMore);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLogs([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || logs.length === 0) return;
    setLoadingMore(true);
    try {
      const supabase = createClient();
      const before = logs[logs.length - 1]?.createdAtIso;
      const page = await listUserWorkoutLogs(supabase, ownerId, {
        limit: WORKOUT_LOGS_PAGE_SIZE,
        before
      });
      const liked = new Set(page.likedLogIds);
      setLogs((prev) => [
        ...prev,
        ...page.logs.map((row) => mapLog(row, liked.has(row.id)))
      ]);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  const activeLog = logs.find((item) => item.id === activeLogId) ?? null;

  return (
    <>
      {showComposer ? (
        <ProfileWorkoutLogComposer
          workoutPlan={workoutPlan}
          onCreated={(log) => {
            setLogs((prev) => [
              log,
              ...prev.filter((item) => item.id !== log.id)
            ]);
          }}
        />
      ) : null}

      <section className="profile-section">
        <div className="profile-section-head">
          <h2>{readOnly ? "Workout logs" : "Your workout logs"}</h2>
          <span>
            {loading
              ? "Loading…"
              : `${logs.length} log${logs.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="profile-posts profile-workout-logs">
          {!loading && logs.length === 0 ? (
            <p className="profile-posts-empty">
              {readOnly
                ? "No workout logs yet."
                : "No workout logs yet. Share your first set above."}
            </p>
          ) : null}
          {logs.map((log) => (
            <ProfileWorkoutLogCard
              key={log.id}
              log={log}
              author={author}
              onOpen={() => setActiveLogId(log.id)}
            />
          ))}
        </div>

        <div className="feed-load-more">
          {loading ? null : hasMore ? (
            <button
              type="button"
              className="feed-load-more-btn"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          ) : logs.length > 0 ? (
            <p className="feed-load-more-done">You’re all caught up</p>
          ) : null}
        </div>
      </section>

      {activeLog ? (
        <ProfileWorkoutLogModal
          log={activeLog}
          author={author}
          onClose={() => setActiveLogId(null)}
          onStatsChange={(logId, stats) => {
            setLogs((prev) =>
              prev.map((item) =>
                item.id === logId
                  ? {
                      ...item,
                      likes: stats.likes,
                      comments: stats.comments,
                      likedByMe: stats.likedByMe
                    }
                  : item
              )
            );
          }}
        />
      ) : null}
    </>
  );
}
