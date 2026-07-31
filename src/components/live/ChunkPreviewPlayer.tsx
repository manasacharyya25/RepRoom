"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LIVE_SESSION_STALE_SECONDS } from "@/lib/streaming/live-sessions";
import { previewChunkUrlFromFolder } from "@/lib/streaming/preview-chunks";

const PRELOAD_AHEAD = 4;
/** Prefer starting one chunk behind the tip so N+1 is usually already on CDN. */
const LIVE_TIP_LAG = 1;

type ChunkPreviewPlayerProps = {
  r2Folder: string;
  /** Latest known chunk from discovery (may be 0 at start). */
  initialLastChunk?: number;
  /**
   * live — follow the tip / detect dead streams.
   * archive — loop chunks 1..initialLastChunk from an ended session.
   */
  mode?: "live" | "archive";
  /** Pre-resolved playable chunk indices (archive). */
  availableChunks?: number[] | null;
  /** Archive session id — used to list+persist chunks when contiguous playback fails. */
  sessionId?: string;
  paused?: boolean;
  className?: string;
  label?: string;
  /** Fired when this stream appears dead (no successful playback within stale window). */
  onDead?: () => void;
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

export function ChunkPreviewPlayer({
  r2Folder,
  initialLastChunk = 0,
  mode = "live",
  availableChunks = null,
  sessionId,
  paused = false,
  className,
  label,
  onDead
}: ChunkPreviewPlayerProps) {
  const publicBase = getPublicBaseUrl();
  const maxChunk = Math.max(1, initialLastChunk || 1);

  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const preloadRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const activeSlotRef = useRef<0 | 1>(0);
  const playingIndexRef = useRef(1);
  const swapGenerationRef = useRef(0);
  const lastGoodAtRef = useRef(Date.now());
  const deadReportedRef = useRef(false);
  const onDeadRef = useRef(onDead);
  onDeadRef.current = onDead;
  const archiveSkipFailsRef = useRef(0);
  const archiveResolveAttemptedRef = useRef(false);
  const playlistRef = useRef<number[] | null>(
    mode === "archive" && availableChunks && availableChunks.length > 0
      ? availableChunks
      : null
  );

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const maxChunkRef = useRef(maxChunk);
  maxChunkRef.current = maxChunk;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const folderRef = useRef(r2Folder);
  folderRef.current = r2Folder;
  const baseRef = useRef(publicBase);
  baseRef.current = publicBase;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [archivePlaylist, setArchivePlaylist] = useState<number[] | null>(
    () =>
      mode === "archive" && availableChunks && availableChunks.length > 0
        ? availableChunks
        : null
  );

  useEffect(() => {
    if (mode !== "archive") {
      playlistRef.current = null;
      setArchivePlaylist(null);
      archiveResolveAttemptedRef.current = false;
      return;
    }
    if (availableChunks && availableChunks.length > 0) {
      playlistRef.current = availableChunks;
      setArchivePlaylist(availableChunks);
      archiveResolveAttemptedRef.current = true;
    }
  }, [mode, availableChunks, r2Folder]);

  const urlFor = useCallback((chunkIndex: number) => {
    const base = baseRef.current;
    if (!base) return null;
    return previewChunkUrlFromFolder(base, folderRef.current, chunkIndex);
  }, []);

  const nextIndex = useCallback((current: number) => {
    if (modeRef.current === "archive") {
      const list = playlistRef.current;
      if (list && list.length > 0) {
        const at = list.indexOf(current);
        if (at < 0) return list[0]!;
        if (at >= list.length - 1) return current;
        return list[at + 1]!;
      }
      if (current >= maxChunkRef.current) return current;
      return current + 1;
    }
    return current + 1;
  }, []);

  const archiveEndChunk = useCallback(() => {
    const list = playlistRef.current;
    if (list && list.length > 0) return list[list.length - 1]!;
    return maxChunkRef.current;
  }, []);

  const resolveArchiveChunks = useCallback(async () => {
    if (modeRef.current !== "archive") return false;
    if (archiveResolveAttemptedRef.current) return false;
    const id = sessionIdRef.current?.trim();
    if (!id) return false;
    archiveResolveAttemptedRef.current = true;
    try {
      const response = await fetch(
        `/api/live/sessions/archive-chunks?sessionId=${encodeURIComponent(id)}`
      );
      const data = (await response.json().catch(() => null)) as {
        chunks?: number[];
      } | null;
      if (!response.ok || !data?.chunks?.length) return false;
      playlistRef.current = data.chunks;
      setArchivePlaylist(data.chunks);
      archiveSkipFailsRef.current = 0;
      return true;
    } catch {
      return false;
    }
  }, []);

  const markDead = useCallback(() => {
    if (deadReportedRef.current) return;
    deadReportedRef.current = true;
    onDeadRef.current?.();
  }, []);

  const markArchiveComplete = useCallback(() => {
    if (modeRef.current !== "archive") return;
    markDead();
  }, [markDead]);

  const warmPreloads = useCallback(
    (afterIndex: number) => {
      let index = nextIndex(afterIndex);
      for (let i = 0; i < PRELOAD_AHEAD; i++) {
        const el = preloadRefs.current[i];
        const url = urlFor(index);
        if (el && url) {
          assignChunkSrc(el, url, index);
        }
        index = nextIndex(index);
      }
    },
    [nextIndex, urlFor]
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

    const active = activeSlotRef.current === 0 ? a : b;
    const standby = activeSlotRef.current === 0 ? b : a;
    const next = nextIndex(playingIndexRef.current);
    const generation = ++swapGenerationRef.current;

    const finishSwap = () => {
      if (generation !== swapGenerationRef.current) return;
      if (pausedRef.current) {
        standby.pause();
      } else {
        void standby.play().catch(() => {});
      }
      active.pause();
      const newSlot = (activeSlotRef.current === 0 ? 1 : 0) as 0 | 1;
      activeSlotRef.current = newSlot;
      setActiveSlot(newSlot);
      playingIndexRef.current = next;
      lastGoodAtRef.current = Date.now();

      prepareStandby(active, nextIndex(next));
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
    const maxAttempts = modeRef.current === "archive" ? 3 : 40;

    const onReady = () => {
      if (generation !== swapGenerationRef.current) return;
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
      if (attempts % 3 === 0) {
        // Nudge CDN fetch for the tip / missing object.
        const url = urlFor(next);
        if (url) {
          standby.removeAttribute("src");
          standby.dataset.chunkIndex = "";
          prepareStandby(standby, next);
        }
      }

      if (attempts < maxAttempts) return;

      window.clearInterval(poll);
      if (modeRef.current === "archive") {
        archiveSkipFailsRef.current += 1;
        if (
          archiveSkipFailsRef.current >= 2 &&
          !archiveResolveAttemptedRef.current
        ) {
          void resolveArchiveChunks();
          return;
        }
        // Skip missing archive chunk; keep last frame until the following one is ready.
        playingIndexRef.current = next;
        prepareStandby(standby, nextIndex(next));
        warmPreloads(next);
        performSwap();
      }
      // Live: keep last frame; stale watchdog handles death if tip never arrives.
    }, 500);
  }, [nextIndex, prepareStandby, resolveArchiveChunks, urlFor, warmPreloads]);

  // Boot / reset when stream identity changes (not on pause).
  useEffect(() => {
    if (!publicBase) return;

    const list = playlistRef.current;
    const start =
      mode === "archive"
        ? list && list.length > 0
          ? list[0]!
          : 1
        : Math.max(1, maxChunk - LIVE_TIP_LAG);

    deadReportedRef.current = false;
    lastGoodAtRef.current = Date.now();
    archiveSkipFailsRef.current = 0;
    swapGenerationRef.current += 1;
    playingIndexRef.current = start;
    activeSlotRef.current = 0;
    setActiveSlot(0);

    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;

    const next =
      mode === "archive"
        ? nextIndex(start) === start
          ? start
          : nextIndex(start)
        : start + 1;
    const startUrl = previewChunkUrlFromFolder(publicBase, r2Folder, start);
    const nextUrl = previewChunkUrlFromFolder(publicBase, r2Folder, next);

    assignChunkSrc(a, startUrl, start);
    assignChunkSrc(b, nextUrl, next);

    // Warm N+1..N+4 via hidden preload videos (HTTP cache for later swaps).
    let warmIndex = next;
    for (let i = 0; i < PRELOAD_AHEAD; i++) {
      const el = preloadRefs.current[i];
      const url = previewChunkUrlFromFolder(publicBase, r2Folder, warmIndex);
      if (el) {
        assignChunkSrc(el, url, warmIndex);
      }
      warmIndex =
        mode === "archive"
          ? nextIndex(warmIndex) === warmIndex
            ? warmIndex
            : nextIndex(warmIndex)
          : warmIndex + 1;
    }

    if (!pausedRef.current) {
      void a.play().catch(() => {
        if (mode === "archive" && !archiveResolveAttemptedRef.current) {
          void resolveArchiveChunks();
        }
      });
    } else {
      a.pause();
    }
    b.pause();
  }, [
    publicBase,
    r2Folder,
    mode,
    maxChunk,
    archivePlaylist,
    nextIndex,
    resolveArchiveChunks
  ]);

  // Pause / resume active element only.
  useEffect(() => {
    const active =
      activeSlotRef.current === 0 ? videoARef.current : videoBRef.current;
    if (!active) return;
    if (paused) {
      active.pause();
      return;
    }
    void active.play().catch(() => {});
  }, [paused, activeSlot]);

  // Ended + near-end prep + errors on both display videos.
  useEffect(() => {
    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;

    const isActive = (video: HTMLVideoElement) =>
      (activeSlotRef.current === 0 ? a : b) === video;

    const onEnded = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement;
      if (!isActive(video)) return;
      lastGoodAtRef.current = Date.now();

      // Archive: one full pass through playlist / 1..max, then hand off for rotation.
      if (
        modeRef.current === "archive" &&
        playingIndexRef.current >= archiveEndChunk()
      ) {
        markArchiveComplete();
        return;
      }

      performSwap();
    };

    const onPlaying = () => {
      lastGoodAtRef.current = Date.now();
    };

    const onTimeUpdate = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement;
      if (
        !isActive(video) ||
        !video.duration ||
        !Number.isFinite(video.duration)
      ) {
        return;
      }
      if (video.duration - video.currentTime > 0.4) return;

      const standby = activeSlotRef.current === 0 ? b : a;
      prepareStandby(standby, nextIndex(playingIndexRef.current));
      warmPreloads(playingIndexRef.current);
    };

    const onError = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement;
      if (!isActive(video)) {
        const wanted = Number(video.dataset.chunkIndex || 0);
        if (!wanted) return;
        window.setTimeout(() => {
          if (video.dataset.chunkIndex !== String(wanted)) return;
          const url = urlFor(wanted);
          if (!url) return;
          video.removeAttribute("src");
          video.dataset.chunkIndex = "";
          assignChunkSrc(video, url, wanted);
        }, 1000);
        return;
      }

      if (modeRef.current === "archive") {
        if (playingIndexRef.current >= archiveEndChunk()) {
          markArchiveComplete();
          return;
        }
        archiveSkipFailsRef.current += 1;
        if (
          archiveSkipFailsRef.current >= 2 &&
          !archiveResolveAttemptedRef.current
        ) {
          void resolveArchiveChunks();
          return;
        }
        playingIndexRef.current = nextIndex(playingIndexRef.current);
        performSwap();
        return;
      }

      window.setTimeout(() => {
        if (deadReportedRef.current) return;
        const url = urlFor(playingIndexRef.current);
        if (!url) return;
        video.removeAttribute("src");
        video.dataset.chunkIndex = "";
        assignChunkSrc(video, url, playingIndexRef.current);
        if (!pausedRef.current) {
          void video.play().catch(() => {});
        }
      }, 1200);
    };

    for (const video of [a, b]) {
      video.addEventListener("ended", onEnded);
      video.addEventListener("playing", onPlaying);
      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("error", onError);
    }

    return () => {
      for (const video of [a, b]) {
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("error", onError);
      }
    };
  }, [
    archiveEndChunk,
    markArchiveComplete,
    nextIndex,
    performSwap,
    prepareStandby,
    resolveArchiveChunks,
    urlFor,
    warmPreloads,
    r2Folder
  ]);

  useEffect(() => {
    if (mode === "archive") return;
    const timer = window.setInterval(() => {
      if (pausedRef.current || deadReportedRef.current) return;
      if (
        Date.now() - lastGoodAtRef.current >
        LIVE_SESSION_STALE_SECONDS * 1000
      ) {
        markDead();
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [markDead, mode]);

  if (!publicBase) {
    return null;
  }

  return (
    <div
      className={`live-video-player live-video-player--dual ${className ?? ""}`}
    >
      <video
        ref={videoARef}
        className={`live-video-player-video${
          activeSlot === 0 ? " is-active" : " is-standby"
        }`}
        muted
        playsInline
        preload="auto"
      />
      <video
        ref={videoBRef}
        className={`live-video-player-video${
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
          className="live-video-player-preload"
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
        />
      ))}
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}
