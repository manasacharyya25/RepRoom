const DEFAULT_WHIP_BASE = "http://localhost:8889";
const DEFAULT_HLS_BASE = "http://localhost:8888";
const DEFAULT_PLAYBACK_BASE = "http://localhost:9996";

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getWhipBaseUrl() {
  return trimSlash(
    process.env.NEXT_PUBLIC_MEDIAMTX_WHIP_BASE?.trim() || DEFAULT_WHIP_BASE
  );
}

export function getHlsBaseUrl() {
  return trimSlash(
    process.env.NEXT_PUBLIC_MEDIAMTX_HLS_BASE?.trim() || DEFAULT_HLS_BASE
  );
}

export function getPlaybackBaseUrl() {
  return trimSlash(
    process.env.NEXT_PUBLIC_MEDIAMTX_PLAYBACK_BASE?.trim() ||
      DEFAULT_PLAYBACK_BASE
  );
}

/** MediaMTX path: live/{roomId}/{userId} */
export function streamPath(roomId: string, userId: string) {
  const room = roomId.trim().replace(/^\/+|\/+$/g, "");
  const user = userId.trim().replace(/^\/+|\/+$/g, "");
  if (!room || !user) throw new Error("Room id and user id are required.");
  return `live/${room}/${user}`;
}

/** WHIP publish endpoint. */
export function whipUrl(roomId: string, userId: string) {
  return `${getWhipBaseUrl()}/${streamPath(roomId, userId)}/whip`;
}

/** Live LL-HLS playlist URL. */
export function hlsUrl(roomId: string, userId: string) {
  return `${getHlsBaseUrl()}/${streamPath(roomId, userId)}/index.m3u8`;
}

/**
 * MediaMTX playback URL for a recorded window.
 * @see https://mediamtx.org/docs/features/playback
 */
export function archivePlaybackUrl(options: {
  mtxPath: string;
  startIso: string;
  durationSec: number;
}) {
  const params = new URLSearchParams({
    path: options.mtxPath,
    start: options.startIso,
    duration: String(Math.max(1, Math.round(options.durationSec)))
  });
  return `${getPlaybackBaseUrl()}/get?${params.toString()}`;
}
