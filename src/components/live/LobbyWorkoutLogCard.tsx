"use client";

import { FeedAuthorHoverCard } from "@/components/feed/FeedAuthorHoverCard";
import { formatDurationClock } from "@/lib/lobby-chat-api";
import type { FeedAuthorPreview } from "@/lib/feed-posts";
import type { LobbyMessageView } from "@/lib/types/lobby-chat";

function authorFromMessage(message: LobbyMessageView): FeedAuthorPreview {
  const username = message.handle.replace(/^@/, "").trim() || null;
  return {
    id: message.senderId,
    name: message.author,
    username: username === "athlete" ? null : username,
    handle: message.handle,
    avatar: message.avatar,
    ageLabel: null,
    countryLabel: null,
    hoursLabel: "—",
    profileHref:
      username && username !== "athlete"
        ? `/u/${encodeURIComponent(username)}`
        : null
  };
}

function formatWeight(weight: string): string {
  const trimmed = weight.trim();
  if (!trimmed) return trimmed;
  if (/\s/.test(trimmed) || /[a-zA-Z]/.test(trimmed)) return trimmed;
  return `${trimmed} kg`;
}

export function LobbyWorkoutLogCard({
  message,
  className = "live-rooms-workout-log"
}: {
  message: LobbyMessageView;
  className?: string;
}) {
  const payload = message.payload;
  if (!payload) {
    return <p className={`${className}-fallback`}>{message.text}</p>;
  }

  const author = authorFromMessage(message);

  return (
    <div className={className}>
      <div className={`${className}-head`}>
        <FeedAuthorHoverCard
          author={author}
          size={22}
          className={`${className}-author`}
          cardPlacement="below"
          portal
        />
        <p className={`${className}-eyebrow`}>Completed Set</p>
      </div>

      <strong className={`${className}-name`}>{payload.exerciseName}</strong>

      {payload.set != null ||
      payload.weight ||
      payload.reps ||
      payload.durationSeconds != null ? (
        <div className={`${className}-stats`}>
          {payload.set != null || payload.weight ? (
            <div className={`${className}-stats-row`}>
              <span>
                {payload.set != null ? `Set ${payload.set}` : ""}
              </span>
              <span>{payload.weight ? formatWeight(payload.weight) : ""}</span>
            </div>
          ) : null}
          {payload.reps || payload.durationSeconds != null ? (
            <div className={`${className}-stats-row`}>
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
    </div>
  );
}
