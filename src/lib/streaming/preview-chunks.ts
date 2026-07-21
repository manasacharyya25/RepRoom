/** Preview chunk upload (R2) — WebM segments of fixed duration. */

const DEFAULT_PREVIEW_CHUNK_SECONDS = 15;
const MIN_PREVIEW_CHUNK_SECONDS = 5;
const MAX_PREVIEW_CHUNK_SECONDS = 60;

function parsePreviewChunkSeconds(raw: string | undefined) {
  if (!raw?.trim()) return DEFAULT_PREVIEW_CHUNK_SECONDS;
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_PREVIEW_CHUNK_SECONDS;
  return Math.min(
    MAX_PREVIEW_CHUNK_SECONDS,
    Math.max(MIN_PREVIEW_CHUNK_SECONDS, Math.floor(value))
  );
}

/**
 * Length of each live preview segment (recorder stop interval + player poll cadence).
 * Override with NEXT_PUBLIC_PREVIEW_CHUNK_SECONDS (5–60).
 */
export const PREVIEW_CHUNK_SECONDS = parsePreviewChunkSeconds(
  process.env.NEXT_PUBLIC_PREVIEW_CHUNK_SECONDS
);
export const PREVIEW_CHUNK_MIME = "video/webm;codecs=vp8";
export const PREVIEW_CHUNK_MIME_FALLBACK = "video/webm";

/** First room for R2 preview pipeline. */
export const PREVIEW_PRIMARY_ROOM_ID = "workout";

/** Dev broadcaster with R2 chunks (MVP tile playback). */
export const PREVIEW_DEV_BROADCASTER_ID =
  "097d14e8-b12d-47d5-95fb-f7753a6a4978";

export function padChunkIndex(index: number) {
  return String(Math.max(0, Math.floor(index))).padStart(6, "0");
}

/**
 * Object key for a live preview chunk.
 * Example: live/workout/{userId}/chunk_000001.webm
 */
export function previewChunkKey(options: {
  roomId: string;
  userId: string;
  chunkIndex: number;
}) {
  const room = options.roomId.trim().replace(/^\/+|\/+$/g, "");
  const user = options.userId.trim().replace(/^\/+|\/+$/g, "");
  if (!room || !user) throw new Error("roomId and userId are required");
  return `live/${room}/${user}/chunk_${padChunkIndex(options.chunkIndex)}.webm`;
}

/** Public CDN / r2.dev URL for a chunk (client playback). */
export function previewChunkPublicUrl(
  publicBaseUrl: string,
  options: { roomId: string; userId: string; chunkIndex: number }
) {
  const base = publicBaseUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("publicBaseUrl is required");
  return `${base}/${previewChunkKey(options)}`;
}

export function pickMediaRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return PREVIEW_CHUNK_MIME_FALLBACK;
  if (MediaRecorder.isTypeSupported(PREVIEW_CHUNK_MIME)) {
    return PREVIEW_CHUNK_MIME;
  }
  if (MediaRecorder.isTypeSupported(PREVIEW_CHUNK_MIME_FALLBACK)) {
    return PREVIEW_CHUNK_MIME_FALLBACK;
  }
  return "";
}
