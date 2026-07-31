"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { previewChunkUrlFromFolder } from "@/lib/streaming/preview-chunks";

const PRELOAD_AHEAD = 4;
/** Contiguous skip/error attempts before resolving the real chunk list from R2. */
const SKIP_BEFORE_RESOLVE = 2;

type OnboardingSessionPlayerProps = {
  r2Folder: string;
  lastChunkNumber: number;
  /** Required to resolve/persist available_chunks after contiguous playback fails. */
  sessionId?: string;
  /** Preloaded from DB when already discovered. */
  availableChunks?: number[] | null;
  /**
   * Where to resolve chunks on failure.
   * onboarding → /api/onboarding-record/chunks
   * admin → /api/rhoq-admin/recorders/{recorderId}/chunks
   */
  chunksResolve?:
    | { kind: "onboarding" }
    | { kind: "admin"; recorderId: string }
    | null;
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

function contiguousPlaylist(lastChunkNumber: number) {
  const max = Math.max(1, Math.floor(lastChunkNumber));
  return Array.from({ length: max }, (_, index) => index + 1);
}

function bootVideos(
  publicBase: string,
  r2Folder: string,
  list: number[],
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement
) {
  if (list.length === 0) return;
  const startChunk = list[0]!;
  const nextChunk = list[1] ?? startChunk;
  assignChunkSrc(
    videoA,
    previewChunkUrlFromFolder(publicBase, r2Folder, startChunk),
    startChunk
  );
  assignChunkSrc(
    videoB,
    previewChunkUrlFromFolder(publicBase, r2Folder, nextChunk),
    nextChunk
  );
  videoA.pause();
  videoB.pause();
}

/** Muted archive playback: no controls, auto-advance chunks, preload 4 ahead. */
export function OnboardingSessionPlayer({
  r2Folder,
  lastChunkNumber,
  sessionId,
  availableChunks = null,
  chunksResolve = null,
  className
}: OnboardingSessionPlayerProps) {
  const publicBase = getPublicBaseUrl();

  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const preloadRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const activeSlotRef = useRef<0 | 1>(0);
  const playingPosRef = useRef(0);
  const swapGenerationRef = useRef(0);
  const folderRef = useRef(r2Folder);
  const baseRef = useRef(publicBase);
  const playlistRef = useRef<number[]>([]);
  const skipFailsRef = useRef(0);
  const resolveAttemptedRef = useRef(false);
  const userStartedRef = useRef(false);
  const performSwapRef = useRef<() => void>(() => undefined);

  folderRef.current = r2Folder;
  baseRef.current = publicBase;

  const [playlist, setPlaylist] = useState<number[]>(() =>
    availableChunks && availableChunks.length > 0
      ? availableChunks
      : contiguousPlaylist(lastChunkNumber)
  );
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [bootKey, setBootKey] = useState(0);

  playlistRef.current = playlist;

  const urlFor = useCallback((chunkIndex: number) => {
    const base = baseRef.current;
    if (!base) return null;
    return previewChunkUrlFromFolder(base, folderRef.current, chunkIndex);
  }, []);

  const chunkAt = useCallback((pos: number) => {
    const list = playlistRef.current;
    if (pos < 0 || pos >= list.length) return null;
    return list[pos] ?? null;
  }, []);

  const warmPreloads = useCallback(
    (afterPos: number) => {
      let pos = afterPos + 1;
      for (let i = 0; i < PRELOAD_AHEAD; i++) {
        const chunk = chunkAt(pos);
        const el = preloadRefs.current[i];
        const url = chunk !== null ? urlFor(chunk) : null;
        if (el && chunk !== null && url) {
          assignChunkSrc(el, url, chunk);
        }
        pos += 1;
      }
    },
    [chunkAt, urlFor]
  );

  const prepareStandby = useCallback(
    (standby: HTMLVideoElement, chunkIndex: number) => {
      const url = urlFor(chunkIndex);
      if (!url) return;
      assignChunkSrc(standby, url, chunkIndex);
    },
    [urlFor]
  );

  const resolveChunkList = useCallback(async () => {
    if (!sessionId || !chunksResolve || resolveAttemptedRef.current) {
      return false;
    }
    resolveAttemptedRef.current = true;
    setResolving(true);
    try {
      const url =
        chunksResolve.kind === "onboarding"
          ? `/api/onboarding-record/chunks?sessionId=${encodeURIComponent(sessionId)}`
          : `/api/rhoq-admin/recorders/${encodeURIComponent(chunksResolve.recorderId)}/chunks?sessionId=${encodeURIComponent(sessionId)}`;
      const response = await fetch(url);
      const data = (await response.json().catch(() => null)) as {
        chunks?: number[];
      } | null;
      if (!response.ok || !data?.chunks?.length) {
        return false;
      }
      skipFailsRef.current = 0;
      playlistRef.current = data.chunks;
      setPlaylist(data.chunks);
      setBootKey((key) => key + 1);
      return true;
    } catch {
      return false;
    } finally {
      setResolving(false);
    }
  }, [chunksResolve, sessionId]);

  const performSwap = useCallback(() => {
    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;

    const currentPos = playingPosRef.current;
    const list = playlistRef.current;
    if (currentPos >= list.length - 1) {
      (activeSlotRef.current === 0 ? a : b).pause();
      return;
    }

    const active = activeSlotRef.current === 0 ? a : b;
    const standby = activeSlotRef.current === 0 ? b : a;
    const nextPos = currentPos + 1;
    const nextChunk = list[nextPos];
    if (nextChunk === undefined) {
      active.pause();
      return;
    }

    const generation = ++swapGenerationRef.current;

    const finishSwap = () => {
      if (generation !== swapGenerationRef.current) return;
      skipFailsRef.current = 0;
      if (userStartedRef.current) {
        void standby.play().catch(() => undefined);
      }
      active.pause();
      const newSlot = (activeSlotRef.current === 0 ? 1 : 0) as 0 | 1;
      activeSlotRef.current = newSlot;
      setActiveSlot(newSlot);
      playingPosRef.current = nextPos;

      const following = list[nextPos + 1];
      if (following !== undefined) {
        prepareStandby(active, following);
      }
      warmPreloads(nextPos);
    };

    if (
      standby.dataset.chunkIndex === String(nextChunk) &&
      standby.readyState >= 2
    ) {
      finishSwap();
      return;
    }

    prepareStandby(standby, nextChunk);

    let attempts = 0;
    const maxAttempts = 8;

    const onReady = () => {
      if (generation !== swapGenerationRef.current) return false;
      if (
        standby.dataset.chunkIndex !== String(nextChunk) ||
        standby.readyState < 2
      ) {
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

      skipFailsRef.current += 1;
      if (
        skipFailsRef.current >= SKIP_BEFORE_RESOLVE &&
        !resolveAttemptedRef.current
      ) {
        void resolveChunkList();
        return;
      }

      playingPosRef.current = nextPos;
      const skipChunk = list[nextPos + 1];
      if (skipChunk !== undefined) {
        prepareStandby(standby, skipChunk);
        warmPreloads(nextPos);
        performSwapRef.current();
      }
    }, 400);
  }, [prepareStandby, resolveChunkList, warmPreloads]);

  performSwapRef.current = performSwap;

  // Reset playlist when the recording identity changes.
  useEffect(() => {
    const initial =
      availableChunks && availableChunks.length > 0
        ? availableChunks
        : contiguousPlaylist(lastChunkNumber);
    resolveAttemptedRef.current = Boolean(
      availableChunks && availableChunks.length > 0
    );
    skipFailsRef.current = 0;
    playlistRef.current = initial;
    setPlaylist(initial);
    setBootKey((key) => key + 1);
  }, [r2Folder, lastChunkNumber, availableChunks]);

  // Load A/B sources whenever bootKey changes (identity or resolved list).
  useEffect(() => {
    if (!publicBase) return;
    userStartedRef.current = false;
    setShowPlayOverlay(true);
    swapGenerationRef.current += 1;
    playingPosRef.current = 0;
    activeSlotRef.current = 0;
    setActiveSlot(0);

    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;
    bootVideos(publicBase, r2Folder, playlistRef.current, a, b);
  }, [publicBase, r2Folder, bootKey]);

  const handlePlayerClick = () => {
    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;
    const active = activeSlotRef.current === 0 ? a : b;

    if (!userStartedRef.current) {
      userStartedRef.current = true;
      setShowPlayOverlay(false);
      warmPreloads(playingPosRef.current);
      void active.play().catch(() => {
        if (!resolveAttemptedRef.current) {
          void resolveChunkList().then((ok) => {
            if (!ok) performSwapRef.current();
          });
        } else {
          performSwapRef.current();
        }
      });
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

  const togglePlayerFullscreen = async (
    event: MouseEvent<HTMLButtonElement>
  ) => {
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

    const onError = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement;
      if (!isActive(video)) return;
      if (!userStartedRef.current) return;

      skipFailsRef.current += 1;
      if (
        skipFailsRef.current >= SKIP_BEFORE_RESOLVE &&
        !resolveAttemptedRef.current
      ) {
        void resolveChunkList().then((ok) => {
          if (!ok) performSwap();
        });
        return;
      }
      performSwap();
    };

    for (const video of [a, b]) {
      video.addEventListener("ended", onEnded);
      video.addEventListener("error", onError);
    }
    return () => {
      for (const video of [a, b]) {
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onError);
      }
    };
  }, [performSwap, resolveChunkList, bootKey]);

  // After resolve rebuilds sources, resume if the user already started.
  useEffect(() => {
    if (!userStartedRef.current) return;
    if (!resolveAttemptedRef.current) return;
    const a = videoARef.current;
    if (!a) return;
    setShowPlayOverlay(false);
    void a.play().catch(() => undefined);
  }, [bootKey]);

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
          {resolving ? "…" : "▶"}
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
