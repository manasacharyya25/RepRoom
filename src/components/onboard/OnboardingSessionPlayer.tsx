"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { previewChunkUrlFromFolder } from "@/lib/streaming/preview-chunks";

const PRELOAD_AHEAD = 4;

type OnboardingSessionPlayerProps = {
  r2Folder: string;
  lastChunkNumber: number;
  className?: string;
};

function getPublicBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ?? ""
  );
}

function assignChunkSrc(
  video: HTMLVideoElement,
  url: string,
  chunkIndex: number
) {
  if (
    video.dataset.chunkIndex === String(chunkIndex) &&
    video.getAttribute("src") === url
  ) {
    return;
  }
  video.dataset.chunkIndex = String(chunkIndex);
  video.src = url;
}

/** Muted archive playback: no controls, auto-advance chunks, preload 4 ahead. */
export function OnboardingSessionPlayer({
  r2Folder,
  lastChunkNumber,
  className
}: OnboardingSessionPlayerProps) {
  const publicBase = getPublicBaseUrl();
  const maxChunk = Math.max(1, Math.floor(lastChunkNumber));

  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const preloadRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const activeSlotRef = useRef<0 | 1>(0);
  const playingIndexRef = useRef(1);
  const swapGenerationRef = useRef(0);
  const maxChunkRef = useRef(maxChunk);
  const folderRef = useRef(r2Folder);
  const baseRef = useRef(publicBase);

  maxChunkRef.current = maxChunk;
  folderRef.current = r2Folder;
  baseRef.current = publicBase;

  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const userStartedRef = useRef(false);

  const urlFor = useCallback((chunkIndex: number) => {
    const base = baseRef.current;
    if (!base) return null;
    return previewChunkUrlFromFolder(base, folderRef.current, chunkIndex);
  }, []);

  const nextIndex = useCallback((current: number) => {
    const max = maxChunkRef.current;
    if (current >= max) return max;
    return current + 1;
  }, []);

  const warmPreloads = useCallback(
    (afterIndex: number) => {
      let index = afterIndex + 1;
      for (let i = 0; i < PRELOAD_AHEAD && index <= maxChunkRef.current; i++) {
        const el = preloadRefs.current[i];
        const url = urlFor(index);
        if (el && url) {
          assignChunkSrc(el, url, index);
        }
        index += 1;
      }
    },
    [urlFor]
  );

  const prepareStandby = useCallback(
    (standby: HTMLVideoElement, chunkIndex: number) => {
      const url = urlFor(chunkIndex);
      if (!url) return;
      assignChunkSrc(standby, url, chunkIndex);
    },
    [urlFor]
  );

  const performSwap = useCallback(() => {
    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;

    const current = playingIndexRef.current;
    const max = maxChunkRef.current;
    if (current >= max) {
      (activeSlotRef.current === 0 ? a : b).pause();
      return;
    }

    const active = activeSlotRef.current === 0 ? a : b;
    const standby = activeSlotRef.current === 0 ? b : a;
    const next = nextIndex(current);
    if (next === current) {
      active.pause();
      return;
    }

    const generation = ++swapGenerationRef.current;

    const finishSwap = () => {
      if (generation !== swapGenerationRef.current) return;
      if (userStartedRef.current) {
        void standby.play().catch(() => undefined);
      }
      active.pause();
      const newSlot = (activeSlotRef.current === 0 ? 1 : 0) as 0 | 1;
      activeSlotRef.current = newSlot;
      setActiveSlot(newSlot);
      playingIndexRef.current = next;

      const following = nextIndex(next);
      if (following !== next) {
        prepareStandby(active, following);
      }
      warmPreloads(next);
    };

    if (
      standby.dataset.chunkIndex === String(next) &&
      standby.readyState >= 2
    ) {
      finishSwap();
      return;
    }

    prepareStandby(standby, next);

    let attempts = 0;
    const maxAttempts = 12;

    const onReady = () => {
      if (generation !== swapGenerationRef.current) return false;
      if (standby.dataset.chunkIndex !== String(next) || standby.readyState < 2) {
        return false;
      }
      finishSwap();
      return true;
    };

    if (onReady()) return;

    const poll = window.setInterval(() => {
      if (generation !== swapGenerationRef.current) {
        window.clearInterval(poll);
        return;
      }
      if (onReady()) {
        window.clearInterval(poll);
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) return;
      window.clearInterval(poll);
      // Skip missing chunk and try the following one.
      playingIndexRef.current = next;
      const skipTo = nextIndex(next);
      if (skipTo !== next) {
        prepareStandby(standby, skipTo);
        warmPreloads(next);
        performSwap();
      }
    }, 500);
  }, [nextIndex, prepareStandby, urlFor, warmPreloads]);

  useEffect(() => {
    if (!publicBase) return;

    userStartedRef.current = false;
    setShowPlayOverlay(true);
    swapGenerationRef.current += 1;
    playingIndexRef.current = 1;
    activeSlotRef.current = 0;
    setActiveSlot(0);

    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;

    const start = 1;
    const next = maxChunk > 1 ? 2 : 1;
    const startUrl = previewChunkUrlFromFolder(publicBase, r2Folder, start);
    const nextUrl = previewChunkUrlFromFolder(publicBase, r2Folder, next);

    assignChunkSrc(a, startUrl, start);
    assignChunkSrc(b, nextUrl, next);

    a.pause();
    b.pause();
  }, [publicBase, r2Folder, maxChunk]);

  const handlePlayerClick = () => {
    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;
    const active = activeSlotRef.current === 0 ? a : b;

    if (!userStartedRef.current) {
      userStartedRef.current = true;
      setShowPlayOverlay(false);
      warmPreloads(playingIndexRef.current);
      void active.play().catch(() => undefined);
      return;
    }

    if (active.paused) {
      setShowPlayOverlay(false);
      void active.play().catch(() => undefined);
    } else {
      active.pause();
      setShowPlayOverlay(true);
    }
  };

  const togglePlayerFullscreen = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const el = containerRef.current;
    if (!el) return;

    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* blocked or unsupported */
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === el);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;

    const isActive = (video: HTMLVideoElement) =>
      (activeSlotRef.current === 0 ? a : b) === video;

    const onEnded = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement;
      if (!isActive(video)) return;
      if (!userStartedRef.current) return;
      performSwap();
    };

    for (const video of [a, b]) {
      video.addEventListener("ended", onEnded);
    }
    return () => {
      for (const video of [a, b]) {
        video.removeEventListener("ended", onEnded);
      }
    };
  }, [performSwap]);

  if (!publicBase || lastChunkNumber < 1) {
    return (
      <div className={className}>
        <p className="onboard-recorder-muted">Preview unavailable</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`onboard-session-player onboard-session-player--dual ${className ?? ""}`}
    >
      <button
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className="onboard-session-player-fullscreen"
        onClick={(event) => {
          void togglePlayerFullscreen(event);
        }}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        type="button"
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          {isFullscreen ? (
            <path
              d="M9 4.75H5.75A1.75 1.75 0 0 0 4 6.5v3.25M15 4.75h3.25A1.75 1.75 0 0 1 20 6.5v3.25M9 19.25H5.75A1.75 1.75 0 0 1 4 17.5v-3.25M15 19.25h3.25A1.75 1.75 0 0 0 20 17.5v-3.25"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          ) : (
            <path
              d="M8.25 4.75H6.5A1.75 1.75 0 0 0 4.75 6.5v1.75M15.75 4.75H17.5A1.75 1.75 0 0 1 19.25 6.5v1.75M8.25 19.25H6.5A1.75 1.75 0 0 1 4.75 17.5v-1.75M15.75 19.25H17.5A1.75 1.75 0 0 0 19.25 17.5v-1.75"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          )}
        </svg>
      </button>
      <button
        aria-label={showPlayOverlay ? "Play recording" : "Pause recording"}
        className="onboard-session-player-hit"
        onClick={handlePlayerClick}
        type="button"
      />
      {showPlayOverlay ? (
        <span aria-hidden className="onboard-session-player-play-icon">
          ▶
        </span>
      ) : null}
      <video
        ref={videoARef}
        className={`onboard-session-player-video${
          activeSlot === 0 ? " is-active" : " is-standby"
        }`}
        muted
        playsInline
        preload="auto"
      />
      <video
        ref={videoBRef}
        className={`onboard-session-player-video${
          activeSlot === 1 ? " is-active" : " is-standby"
        }`}
        muted
        playsInline
        preload="auto"
      />
      {Array.from({ length: PRELOAD_AHEAD }, (_, index) => (
        <video
          key={`preload-${index}`}
          ref={(el) => {
            preloadRefs.current[index] = el;
          }}
          aria-hidden
          className="onboard-session-player-preload"
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
        />
      ))}
    </div>
  );
}
