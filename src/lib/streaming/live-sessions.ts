import { PREVIEW_CHUNK_SECONDS } from "@/lib/streaming/preview-chunks";
import { LIVE_IMAGES } from "@/lib/live-images";
import type { FeedAuthorPreview } from "@/lib/feed-posts";
import {
  formatAgeRange,
  formatCountry,
  formatHoursWorked
} from "@/lib/profile-labels";
import { normalizeAvailableChunks } from "@/lib/streaming/list-archive-chunks";

const DEFAULT_STALE_MULTIPLIER = 3;
const MIN_STALE_SECONDS = 15;
const MAX_STALE_SECONDS = 300;

function parseStaleSeconds(raw: string | undefined) {
  if (!raw?.trim()) {
    return Math.min(
      MAX_STALE_SECONDS,
      Math.max(MIN_STALE_SECONDS, PREVIEW_CHUNK_SECONDS * DEFAULT_STALE_MULTIPLIER)
    );
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return Math.min(
      MAX_STALE_SECONDS,
      Math.max(MIN_STALE_SECONDS, PREVIEW_CHUNK_SECONDS * DEFAULT_STALE_MULTIPLIER)
    );
  }
  return Math.min(MAX_STALE_SECONDS, Math.max(MIN_STALE_SECONDS, Math.floor(value)));
}

/**
 * A live session drops out of discovery when last_chunk_uploaded_at is older than this.
 * Override with NEXT_PUBLIC_LIVE_SESSION_STALE_SECONDS (15–300).
 * Default: 3 × preview chunk duration.
 */
export const LIVE_SESSION_STALE_SECONDS = parseStaleSeconds(
  process.env.NEXT_PUBLIC_LIVE_SESSION_STALE_SECONDS
);

/** Immersive room tile count (2 main + 4 bottom + 5 rail). */
export const LIVE_DISCOVERY_PAGE_SIZE = 11;

export const LIVE_SESSION_PROFILE_SELECT =
  "id, display_name, username, avatar_url, age_range, country_code, goals(template_id, current_value, target_value)";

export type LiveSessionStatus = "live" | "ended";

export type LiveSessionRow = {
  session_id: string;
  user_id: string;
  room_id: string;
  r2_folder: string;
  status: LiveSessionStatus;
  started_at: string;
  ended_at: string | null;
  last_chunk_number: number;
  last_chunk_uploaded_at: string;
  available_chunks?: number[] | null;
};

/** Rows moved out of live_sessions by the archive cron job. */
export type ArchiveSessionRow = LiveSessionRow & {
  archived_at?: string;
  archive_reason?: "ended" | "stale" | string;
};

export type LiveSessionProfile = {
  id?: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  age_range?: string | null;
  country_code?: string | null;
  goals?:
    | {
        template_id: string;
        current_value: number | null;
        target_value?: number | null;
      }[]
    | null;
};

export type LiveSessionView = {
  sessionId: string;
  userId: string;
  roomId: string;
  r2Folder: string;
  lastChunkNumber: number;
  lastChunkUploadedAt: string;
  startedAt: string;
  availableChunks?: number[] | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  author?: FeedAuthorPreview | null;
};

function hoursFromGoals(
  goals:
    | {
        template_id: string;
        current_value: number | null;
      }[]
    | null
    | undefined
) {
  const row = goals?.find((goal) => goal.template_id === "hours_worked");
  return Number(row?.current_value ?? 0);
}

export function authorFromLiveProfile(
  userId: string,
  profile?: LiveSessionProfile | null
): FeedAuthorPreview {
  const username = profile?.username?.trim() || null;
  const name = profile?.display_name?.trim() || "Athlete";
  const handle = username ? `@${username}` : "@athlete";
  const avatar = profile?.avatar_url?.trim() || LIVE_IMAGES.participant4;

  return {
    id: userId,
    name,
    username,
    handle,
    avatar,
    ageLabel: formatAgeRange(profile?.age_range),
    countryLabel: formatCountry(profile?.country_code),
    hoursLabel: formatHoursWorked(hoursFromGoals(profile?.goals)),
    profileHref: username ? `/u/${encodeURIComponent(username)}` : null
  };
}

export function liveSessionR2Folder(options: {
  roomId: string;
  userId: string;
  sessionId: string;
}) {
  const room = options.roomId.trim().replace(/^\/+|\/+$/g, "");
  const user = options.userId.trim().replace(/^\/+|\/+$/g, "");
  const session = options.sessionId.trim().replace(/^\/+|\/+$/g, "");
  if (!room || !user || !session) {
    throw new Error("roomId, userId, and sessionId are required");
  }
  return `live/${room}/${user}/${session}`;
}

export function mapLiveSessionRow(
  row: LiveSessionRow,
  profile?: LiveSessionProfile | null
): LiveSessionView {
  const author = authorFromLiveProfile(row.user_id, profile);
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    roomId: row.room_id,
    r2Folder: row.r2_folder,
    lastChunkNumber: row.last_chunk_number,
    lastChunkUploadedAt: row.last_chunk_uploaded_at,
    startedAt: row.started_at,
    availableChunks: normalizeAvailableChunks(row.available_chunks),
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    author
  };
}

export function encodeLiveCursor(row: {
  last_chunk_uploaded_at: string;
  session_id: string;
}) {
  return Buffer.from(
    JSON.stringify({
      t: row.last_chunk_uploaded_at,
      id: row.session_id
    }),
    "utf8"
  ).toString("base64url");
}

export function decodeLiveCursor(cursor: string | null | undefined): {
  t: string;
  id: string;
} | null {
  if (!cursor?.trim()) return null;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { t?: string; id?: string };
    if (!parsed.t || !parsed.id) return null;
    return { t: parsed.t, id: parsed.id };
  } catch {
    return null;
  }
}
