"use client";

import { useEffect, useId, useRef, useState } from "react";
import { youtubeEmbedSrc } from "@/lib/guest-preview-videos";
import {
  loadYouTubeIframeApi,
  type YtPlayer
} from "@/lib/youtube-iframe-api";

/** Reveal after this much actual PLAYING time (not wall-clock from mount). */
const PLAYBACK_REVEAL_MS = 5000;
const REVEAL_FADE_MS = 600;

type YouTubePreviewEmbedProps = {
  videoId: string;
  /** When true, unload the iframe to stop playback (e.g. tab hidden). */
  paused?: boolean;
  className?: string;
  title?: string;
};

/**
 * Cropped, muted, looping YouTube embed for guest preview tiles.
 * Blur cover lifts after ~5s of real playback so YT chrome can settle.
 */
export function YouTubePreviewEmbed({
  videoId,
  paused = false,
  className,
  title = "Workout preview"
}: YouTubePreviewEmbedProps) {
  const reactId = useId().replace(/:/g, "");
  const iframeDomId = `yt-preview-${reactId}`;
  const [covered, setCovered] = useState(true);
  const playerRef = useRef<YtPlayer | null>(null);
  const playedMsRef = useRef(0);
  const playingSinceRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) {
      setCovered(true);
      playedMsRef.current = 0;
      playingSinceRef.current = null;
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      return;
    }

    setCovered(true);
    playedMsRef.current = 0;
    playingSinceRef.current = null;
    let cancelled = false;

    const clearTick = () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };

    const flushPlayed = () => {
      if (playingSinceRef.current === null) return;
      playedMsRef.current += Date.now() - playingSinceRef.current;
      playingSinceRef.current = Date.now();
      if (playedMsRef.current >= PLAYBACK_REVEAL_MS) {
        setCovered(false);
        clearTick();
        playingSinceRef.current = null;
      }
    };

    const startTick = () => {
      if (tickRef.current) return;
      tickRef.current = setInterval(flushPlayed, 200);
    };

    const stopAccumulating = () => {
      if (playingSinceRef.current !== null) {
        playedMsRef.current += Date.now() - playingSinceRef.current;
        playingSinceRef.current = null;
      }
      clearTick();
    };

    void (async () => {
      try {
        const YT = await loadYouTubeIframeApi();
        if (cancelled) return;

        // Wait a frame so the iframe is in the DOM
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        if (cancelled) return;

        const el = document.getElementById(iframeDomId);
        if (!el) return;

        playerRef.current = new YT.Player(iframeDomId, {
          events: {
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === YT.PlayerState.PLAYING) {
                if (playedMsRef.current >= PLAYBACK_REVEAL_MS) {
                  setCovered(false);
                  return;
                }
                playingSinceRef.current = Date.now();
                startTick();
              } else {
                stopAccumulating();
              }
            }
          }
        });
      } catch {
        // API unavailable — fall back to wall-clock after mount
        if (!cancelled) {
          window.setTimeout(() => {
            if (!cancelled) setCovered(false);
          }, PLAYBACK_REVEAL_MS + 2000);
        }
      }
    })();

    return () => {
      cancelled = true;
      stopAccumulating();
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [paused, videoId, iframeDomId]);

  return (
    <div
      className={`yt-embed-holder${className ? ` ${className}` : ""}${
        covered ? " is-covered" : " is-revealed"
      }`}
      aria-hidden
    >
      {!paused ? (
        <iframe
          id={iframeDomId}
          src={youtubeEmbedSrc(videoId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : null}
      <div
        className="yt-embed-cover"
        style={{ transitionDuration: `${REVEAL_FADE_MS}ms` }}
      />
    </div>
  );
}
