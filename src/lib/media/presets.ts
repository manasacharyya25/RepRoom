export type ImagePresetName = "avatar" | "post" | "thumb";

export type ImagePreset = {
  /** Longest side in pixels after resize. */
  maxEdge: number;
  /** Reject uploads larger than this before compression. */
  maxBytes: number;
  /** Encoder quality for lossy formats (0–1). */
  quality: number;
  /** Preferred output mime; falls back to JPEG if unsupported. */
  format: "image/webp" | "image/jpeg";
  /** Skip re-encode when already under this size and within maxEdge. */
  skipUnderBytes: number;
};

export const IMAGE_PRESETS: Record<ImagePresetName, ImagePreset> = {
  avatar: {
    maxEdge: 512,
    maxBytes: 5 * 1024 * 1024,
    quality: 0.82,
    format: "image/webp",
    skipUnderBytes: 180_000
  },
  post: {
    maxEdge: 1600,
    maxBytes: 12 * 1024 * 1024,
    quality: 0.8,
    format: "image/webp",
    skipUnderBytes: 500_000
  },
  thumb: {
    maxEdge: 400,
    maxBytes: 12 * 1024 * 1024,
    quality: 0.75,
    format: "image/webp",
    skipUnderBytes: 120_000
  }
};

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
] as const;

export type StorageBucket = "avatars" | "posts";
