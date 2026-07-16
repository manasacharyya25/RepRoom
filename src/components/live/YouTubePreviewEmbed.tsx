"use client";

import { youtubeEmbedSrc } from "@/lib/guest-preview-videos";

type YouTubePreviewEmbedProps = {
  videoId: string;
  /** When true, unload the iframe to stop playback (e.g. tab hidden). */
  paused?: boolean;
  className?: string;
  title?: string;
};

/**
 * Cropped, muted, looping YouTube embed for guest preview tiles.
 * CSS zooms the iframe so player chrome is clipped.
 */
export function YouTubePreviewEmbed({
  videoId,
  paused = false,
  className,
  title = "Workout preview"
}: YouTubePreviewEmbedProps) {
  return (
    <div
      className={`yt-embed-holder${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      {!paused ? (
        <iframe
          src={youtubeEmbedSrc(videoId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : null}
    </div>
  );
}
