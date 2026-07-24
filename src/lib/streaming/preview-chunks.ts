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

export function padChunkIndex(index: number) {
  return String(Math.max(0, Math.floor(index))).padStart(6, "0");
}

/**
 * Object key for a live preview chunk.
 * Example: live/workout/{userId}/{sessionId}/chunk_000001.webm
 */
export function previewChunkKey(options: {
  roomId: string;
  userId: string;
  sessionId: string;
  chunkIndex: number;
}) {
  const room = options.roomId.trim().replace(/^\/+|\/+$/g, "");
  const user = options.userId.trim().replace(/^\/+|\/+$/g, "");
  const session = options.sessionId.trim().replace(/^\/+|\/+$/g, "");
  if (!room || !user || !session) {
    throw new Error("roomId, userId, and sessionId are required");
  }
  return `live/${room}/${user}/${session}/chunk_${padChunkIndex(options.chunkIndex)}.webm`;
}

/** Public CDN / r2.dev URL for a chunk (client playback). */
export function previewChunkPublicUrl(
  publicBaseUrl: string,
  options: {
    roomId: string;
    userId: string;
    sessionId: string;
    chunkIndex: number;
  }
) {
  const base = publicBaseUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("publicBaseUrl is required");
  return `${base}/${previewChunkKey(options)}`;
}

/** Public URL from an r2_folder + chunk index. */
export function previewChunkUrlFromFolder(
  publicBaseUrl: string,
  r2Folder: string,
  chunkIndex: number
) {
  const base = publicBaseUrl.trim().replace(/\/+$/, "");
  const folder = r2Folder.trim().replace(/^\/+|\/+$/g, "");
  if (!base || !folder) throw new Error("publicBaseUrl and r2Folder are required");
  return `${base}/${folder}/chunk_${padChunkIndex(chunkIndex)}.webm`;
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
