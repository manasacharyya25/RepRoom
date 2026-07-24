"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/app/landing.css";
import "@/app/live-rooms.css";
import { AppNav } from "@/components/nav/AppNav";
import { useEntitlements } from "@/components/auth/EntitlementsProvider";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { ChunkPreviewPlayer } from "@/components/live/ChunkPreviewPlayer";
import { FeedAuthorHoverCard } from "@/components/feed/FeedAuthorHoverCard";
import type { FeedAuthorPreview } from "@/lib/feed-posts";
import "@/app/billing.css";
import {
  canAccessRoom,
  formatRemainingTime,
  GUEST_ROOM_ID,
  type Tier,
  type UpgradeReason
} from "@/lib/entitlements";
import { exitFullscreen, toggleFullscreen } from "@/lib/fullscreen";
import {
  fetchLobbySenderProfile,
  formatLobbyRelativeTime,
  listLobbyMessages,
  mapDbLobbyMessageToView,
  sendLobbyMessage
} from "@/lib/lobby-chat-api";
import { LIVE_IMAGES } from "@/lib/live-images";
import {
  getRoomLiveSets,
  WORKOUT_ROOMS,
  type RoomLiveSet,
  type WorkoutRoom
} from "@/lib/rooms";
import {
  captureLiveCamera,
  stopMediaStream
} from "@/lib/streaming/capture";
import {
  startChunkRecorder,
  type ChunkRecorder
} from "@/lib/streaming/chunk-recorder";
import {
  LIVE_DISCOVERY_PAGE_SIZE,
  type LiveSessionView
} from "@/lib/streaming/live-sessions";
import { createClient } from "@/lib/supabase/client";
import type {
  DbLobbyMessage,
  LobbyMessageView
} from "@/lib/types/lobby-chat";
import { LOBBY_MESSAGE_MAX_LENGTH } from "@/lib/types/lobby-chat";

function isRemoteSrc(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

function cloneLiveSet(set: RoomLiveSet): RoomLiveSet {
  return {
    main: [set.main[0], set.main[1]],
    bottom: [set.bottom[0], set.bottom[1], set.bottom[2], set.bottom[3]],
    rail: [set.rail[0], set.rail[1], set.rail[2], set.rail[3], set.rail[4]]
  };
}

const MOBILE_VIEWPORT_QUERY = "(max-width: 960px)";

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

function TileUserLabel({
  label,
  labelPosition = "left",
  author,
  variant = "tile"
}: {
  label: string;
  labelPosition?: "left" | "center";
  author?: FeedAuthorPreview | null;
  variant?: "tile" | "featured";
}) {
  const labelClass =
    variant === "featured"
      ? "live-rooms-featured-label"
      : `live-rooms-tile-label${
          labelPosition === "center" ? " live-rooms-tile-label--center" : ""
        }`;

  if (!author) {
    return <span className={labelClass}>{label}</span>;
  }

  return (
    <FeedAuthorHoverCard
      author={author}
      cardPlacement="above"
      className={`live-rooms-tile-author-hover${
        labelPosition === "center"
          ? " live-rooms-tile-author-hover--center"
          : ""
      }${variant === "featured" ? " live-rooms-tile-author-hover--featured" : ""}`}
    >
      <span className={`${labelClass} is-interactive`}>{label}</span>
    </FeedAuthorHoverCard>
  );
}

function LiveTile({
  className,
  image,
  chunkPreview,
  label,
  labelPosition = "left",
  author = null,
  priority = false,
  sizes,
  paused
}: {
  className?: string;
  image: string;
  /** Live or ended R2 chunk preview from discovery. */
  chunkPreview?: {
    r2Folder: string;
    lastChunkNumber?: number;
    mode?: "live" | "archive";
    onDead?: () => void;
  } | null;
  label: string;
  labelPosition?: "left" | "center";
  author?: FeedAuthorPreview | null;
  priority?: boolean;
  sizes: string;
  paused?: boolean;
}) {
  return (
    <div
      aria-label={label}
      className={`live-rooms-preview-tile ${className ?? ""}`}
      role="group"
    >
      {chunkPreview ? (
        <ChunkPreviewPlayer
          className="live-rooms-tile-video"
          initialLastChunk={chunkPreview.lastChunkNumber}
          mode={chunkPreview.mode}
          onDead={chunkPreview.onDead}
          paused={paused}
          r2Folder={chunkPreview.r2Folder}
          label={label}
        />
      ) : (
        <Image
          alt=""
          className="live-rooms-tile-image"
          fill
          priority={priority}
          sizes={sizes}
          src={image}
        />
      )}
      <TileUserLabel
        author={author}
        label={label}
        labelPosition={labelPosition}
      />
    </div>
  );
}

export function ImmersiveRoom({
  room,
  onLeave,
  tier = "free",
  remainingSeconds = null,
  quotaSeconds = 0,
  onNeedSignInToGoLive,
  staticPreviewOnly = false,
  blurred = false
}: {
  room: WorkoutRoom;
  onLeave: () => void | Promise<void>;
  tier?: Tier;
  remainingSeconds?: number | null;
  /** Guest view quota used for the depleting progress bar. */
  quotaSeconds?: number;
  onNeedSignInToGoLive?: () => void;
  /** Force static images only — used when view limit hits. */
  staticPreviewOnly?: boolean;
  /** Blur the room UI under a limit modal. */
  blurred?: boolean;
}) {
  const isMobileViewport = useIsMobileViewport();
  const liveSets = useMemo(() => getRoomLiveSets(room), [room]);
  const [liveSetIndex, setLiveSetIndex] = useState(0);
  const [layout, setLayout] = useState<RoomLiveSet>(() =>
    cloneLiveSet(liveSets[0] ?? getRoomLiveSets(room)[0])
  );
  const [selfMainSlot, setSelfMainSlot] = useState<0 | 1>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const isLiveRef = useRef(false);
  isLiveRef.current = isLive;
  /** Slot 0 reserved for local camera; discovery shifted right while live. */
  const selfSlotReservedRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [tabHidden, setTabHidden] = useState(false);
  const [viewTimerPercent, setViewTimerPercent] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkRecorderRef = useRef<ChunkRecorder | null>(null);
  /** R2 live_sessions row id. */
  const liveR2SessionIdRef = useRef<string | null>(null);
  const liveEpochRef = useRef(0);
  const [liveSlots, setLiveSlots] = useState<(LiveSessionView | null)[]>(() =>
    Array.from({ length: LIVE_DISCOVERY_PAGE_SIZE }, () => null)
  );
  const [archiveSlots, setArchiveSlots] = useState<(LiveSessionView | null)[]>(
    () => Array.from({ length: LIVE_DISCOVERY_PAGE_SIZE }, () => null)
  );
  const liveSlotsRef = useRef(liveSlots);
  liveSlotsRef.current = liveSlots;
  const archiveSlotsRef = useRef(archiveSlots);
  archiveSlotsRef.current = archiveSlots;
  const viewEndsAtRef = useRef<number | null>(null);
  const activeSet = liveSets[liveSetIndex] ?? liveSets[0];

  const showViewTimer =
    tier === "guest" &&
    quotaSeconds > 0 &&
    remainingSeconds !== null &&
    remainingSeconds >= 0;

  useEffect(() => {
    if (!showViewTimer) {
      viewEndsAtRef.current = null;
      setViewTimerPercent(null);
      return;
    }

    viewEndsAtRef.current = Date.now() + remainingSeconds * 1000;

    const tick = () => {
      const endsAt = viewEndsAtRef.current;
      if (endsAt === null) return;
      const leftMs = Math.max(0, endsAt - Date.now());
      setViewTimerPercent(
        Math.max(0, Math.min(100, (leftMs / (quotaSeconds * 1000)) * 100))
      );
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [showViewTimer, remainingSeconds, quotaSeconds]);

  const emptyDiscoverySlots = () =>
    Array.from(
      { length: LIVE_DISCOVERY_PAGE_SIZE },
      () => null as LiveSessionView | null
    );

  const shiftDiscoveryRightForSelf = useCallback(() => {
    if (selfSlotReservedRef.current) return;
    selfSlotReservedRef.current = true;
    setSelfMainSlot(0);
    setLiveSlots((prev) => [
      null,
      ...prev.slice(0, LIVE_DISCOVERY_PAGE_SIZE - 1)
    ]);
    setArchiveSlots((prev) => [
      null,
      ...prev.slice(0, LIVE_DISCOVERY_PAGE_SIZE - 1)
    ]);
  }, []);

  const releaseDiscoverySelfSlot = useCallback(() => {
    if (!selfSlotReservedRef.current) return;
    selfSlotReservedRef.current = false;
    setLiveSlots((prev) => [...prev.slice(1), null]);
    setArchiveSlots((prev) => [...prev.slice(1), null]);
  }, []);

  useEffect(() => {
    setLayout(cloneLiveSet(activeSet));
    setSelfMainSlot(0);
  }, [liveSetIndex, liveSets]);

  useEffect(() => {
    const onVisibility = () => {
      setTabHidden(document.hidden);
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const pauseIncoming = tabHidden;

  const attachStreamToVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    if (!video || !streamRef.current) return;
    if (video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
    }
    void video.play().catch(() => {
      /* Autoplay can fail briefly while permissions settle */
    });
  }, []);

  const showPreviousSet = () => {
    setLiveSetIndex((index) => (index - 1 + liveSets.length) % liveSets.length);
  };

  const showNextSet = () => {
    setLiveSetIndex((index) => (index + 1) % liveSets.length);
  };

  const stopCamera = useCallback(() => {
    liveEpochRef.current += 1;

    const liveR2SessionId = liveR2SessionIdRef.current;
    liveR2SessionIdRef.current = null;

    chunkRecorderRef.current?.stop();
    chunkRecorderRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLive(false);
    setIsGoingLive(false);
    releaseDiscoverySelfSlot();

    if (liveR2SessionId) {
      void fetch("/api/live/sessions/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: liveR2SessionId })
      }).catch(() => {
        /* End session is best-effort */
      });
    }
  }, [releaseDiscoverySelfSlot]);

  const startCamera = useCallback(async () => {
    setIsGoingLive(true);
    setCameraError(null);

    const epoch = liveEpochRef.current + 1;
    liveEpochRef.current = epoch;

    try {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setIsGoingLive(false);
        onNeedSignInToGoLive?.();
        return;
      }

      const stream = await captureLiveCamera();
      if (liveEpochRef.current !== epoch) {
        stopMediaStream(stream);
        return;
      }

      streamRef.current = stream;
      setSelfMainSlot(0);
      shiftDiscoveryRightForSelf();
      setIsLive(true);
      setIsGoingLive(false);
      attachStreamToVideo(videoRef.current);

      void (async () => {
        if (liveEpochRef.current !== epoch || !streamRef.current) return;

        try {
          const liveResponse = await fetch("/api/live/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: room.id })
          });
          if (!liveResponse.ok || liveEpochRef.current !== epoch) {
            if (liveEpochRef.current === epoch) {
              stopCamera();
              setCameraError("Could not start live session.");
            }
            return;
          }
          const liveData = (await liveResponse.json()) as {
            session: LiveSessionView;
          };
          liveR2SessionIdRef.current = liveData.session.sessionId;

          chunkRecorderRef.current?.stop();
          chunkRecorderRef.current = startChunkRecorder({
            stream: streamRef.current,
            roomId: room.id,
            sessionId: liveData.session.sessionId,
            onError: (message) => {
              console.warn("[preview-chunks]", message);
            },
            onUploaded: (info) => {
              console.info("[preview-chunks] uploaded", info.key);
            }
          });
        } catch {
          if (liveEpochRef.current === epoch) {
            stopCamera();
            setCameraError("Could not start live session.");
          }
        }
      })();
    } catch (error) {
      if (liveEpochRef.current === epoch) {
        stopCamera();
        setCameraError(
          error instanceof Error
            ? error.message
            : "Could not access your camera."
        );
      }
    } finally {
      if (liveEpochRef.current === epoch) {
        setIsGoingLive(false);
      }
    }
  }, [
    attachStreamToVideo,
    onNeedSignInToGoLive,
    room.id,
    shiftDiscoveryRightForSelf,
    stopCamera
  ]);

  const discoveryEnabled = !staticPreviewOnly;

  const fetchEndedArchives = useCallback(
    async (options: {
      limit: number;
      excludeSessionIds: string[];
      excludeUserIds: string[];
    }) => {
      if (options.limit <= 0) return [] as LiveSessionView[];
      const params = new URLSearchParams({
        roomId: room.id,
        limit: String(options.limit)
      });
      if (options.excludeSessionIds.length > 0) {
        params.set("exclude", options.excludeSessionIds.join(","));
      }
      if (options.excludeUserIds.length > 0) {
        params.set("excludeUsers", options.excludeUserIds.join(","));
      }
      const response = await fetch(
        `/api/live/sessions/archives?${params.toString()}`
      );
      if (!response.ok) return [];
      const data = (await response.json()) as {
        sessions?: LiveSessionView[];
      };
      return data.sessions ?? [];
    },
    [room.id]
  );

  const fillArchiveSlots = useCallback(
    async (
      live: (LiveSessionView | null)[],
      previousArchives: (LiveSessionView | null)[] = emptyDiscoverySlots()
    ) => {
      const nextArchives = emptyDiscoverySlots();
      const usedSessionIds = new Set<string>();
      const usedUserIds = new Set<string>();
      const reserveSelf = selfSlotReservedRef.current;
      const fillStart = reserveSelf ? 1 : 0;

      for (const session of live) {
        if (!session) continue;
        usedSessionIds.add(session.sessionId);
        usedUserIds.add(session.userId);
      }
      if (liveR2SessionIdRef.current) {
        usedSessionIds.add(liveR2SessionIdRef.current);
      }

      // Keep existing archive assignments on still-empty live slots when possible.
      for (let index = fillStart; index < LIVE_DISCOVERY_PAGE_SIZE; index++) {
        if (live[index]) continue;
        const existing = previousArchives[index];
        if (
          existing &&
          !usedSessionIds.has(existing.sessionId) &&
          !usedUserIds.has(existing.userId)
        ) {
          nextArchives[index] = existing;
          usedSessionIds.add(existing.sessionId);
          usedUserIds.add(existing.userId);
        }
      }

      const emptyIndexes: number[] = [];
      for (let index = fillStart; index < LIVE_DISCOVERY_PAGE_SIZE; index++) {
        if (!live[index] && !nextArchives[index]) {
          emptyIndexes.push(index);
        }
      }

      if (emptyIndexes.length === 0) {
        return nextArchives;
      }

      const fetched = await fetchEndedArchives({
        limit: emptyIndexes.length,
        excludeSessionIds: [...usedSessionIds],
        excludeUserIds: [...usedUserIds]
      });

      emptyIndexes.forEach((slotIndex, fetchIndex) => {
        nextArchives[slotIndex] = fetched[fetchIndex] ?? null;
      });

      return nextArchives;
    },
    [fetchEndedArchives]
  );

  const replaceLiveSlot = useCallback(
    async (slotIndex: number, deadSessionId: string) => {
      if (!discoveryEnabled) return;

      const exclude = new Set(
        liveSlotsRef.current
          .filter((session): session is LiveSessionView => Boolean(session))
          .map((session) => session.sessionId)
      );
      exclude.add(deadSessionId);
      if (liveR2SessionIdRef.current) {
        exclude.add(liveR2SessionIdRef.current);
      }

      let replacement: LiveSessionView | null = null;
      try {
        const response = await fetch(
          `/api/live/sessions/replace?roomId=${encodeURIComponent(room.id)}&exclude=${encodeURIComponent(
            [...exclude].join(",")
          )}`
        );
        if (response.ok) {
          const data = (await response.json()) as {
            session?: LiveSessionView | null;
          };
          replacement = data.session ?? null;
        }
      } catch {
        replacement = null;
      }

      const nextLive = [...liveSlotsRef.current];
      if (selfSlotReservedRef.current && slotIndex === 0) return;
      if (nextLive[slotIndex]?.sessionId !== deadSessionId) return;
      nextLive[slotIndex] = replacement;
      setLiveSlots(nextLive);

      if (!replacement) {
        const nextArchives = await fillArchiveSlots(
          nextLive,
          archiveSlotsRef.current
        );
        setArchiveSlots(nextArchives);
      } else {
        setArchiveSlots((prev) => {
          const next = [...prev];
          next[slotIndex] = null;
          return next;
        });
      }
    },
    [discoveryEnabled, fillArchiveSlots, room.id]
  );

  useEffect(() => {
    if (!discoveryEnabled) {
      setLiveSlots(emptyDiscoverySlots());
      setArchiveSlots(emptyDiscoverySlots());
      return;
    }

    let cancelled = false;

    const loadDiscovery = async () => {
      try {
        const response = await fetch(
          `/api/live/sessions?roomId=${encodeURIComponent(room.id)}&limit=${LIVE_DISCOVERY_PAGE_SIZE}`
        );
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as {
          sessions?: LiveSessionView[];
        };
        const selfId = liveR2SessionIdRef.current;
        const sessions = (data.sessions ?? []).filter(
          (session) => session.sessionId !== selfId
        );
        const reserveSelf = selfSlotReservedRef.current;
        const nextLive = emptyDiscoverySlots();
        if (reserveSelf) {
          sessions
            .slice(0, LIVE_DISCOVERY_PAGE_SIZE - 1)
            .forEach((session, index) => {
              nextLive[index + 1] = session;
            });
        } else {
          sessions
            .slice(0, LIVE_DISCOVERY_PAGE_SIZE)
            .forEach((session, index) => {
              nextLive[index] = session;
            });
        }
        if (cancelled) return;
        setLiveSlots(nextLive);

        const nextArchives = await fillArchiveSlots(
          nextLive,
          archiveSlotsRef.current
        );
        if (cancelled) return;
        setArchiveSlots(nextArchives);
      } catch {
        /* optional */
      }
    };

    void loadDiscovery();
    return () => {
      cancelled = true;
    };
  }, [discoveryEnabled, fillArchiveSlots, room.id]);

  const hasEmptyDiscoveryTile = useMemo(() => {
    if (!discoveryEnabled) return false;
    const fillStart = isLive ? 1 : 0;
    for (let index = fillStart; index < LIVE_DISCOVERY_PAGE_SIZE; index++) {
      if (!liveSlots[index] && !archiveSlots[index]) return true;
    }
    return false;
  }, [archiveSlots, discoveryEnabled, isLive, liveSlots]);

  // While any tile is empty, re-check for new live sessions once a minute.
  useEffect(() => {
    if (!discoveryEnabled || !hasEmptyDiscoveryTile) return;

    let cancelled = false;
    const EMPTY_TILE_POLL_MS = 60_000;

    const fillEmptyWithNewLives = async () => {
      const live = liveSlotsRef.current;
      const archives = archiveSlotsRef.current;
      const reserveSelf = selfSlotReservedRef.current;
      const fillStart = reserveSelf ? 1 : 0;

      const emptyIndexes: number[] = [];
      for (let index = fillStart; index < LIVE_DISCOVERY_PAGE_SIZE; index++) {
        if (!live[index] && !archives[index]) {
          emptyIndexes.push(index);
        }
      }
      if (emptyIndexes.length === 0) return;

      try {
        const response = await fetch(
          `/api/live/sessions?roomId=${encodeURIComponent(room.id)}&limit=${LIVE_DISCOVERY_PAGE_SIZE}`
        );
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as {
          sessions?: LiveSessionView[];
        };

        const selfId = liveR2SessionIdRef.current;
        const usedSessionIds = new Set<string>();
        const usedUserIds = new Set<string>();
        for (const session of live) {
          if (!session) continue;
          usedSessionIds.add(session.sessionId);
          usedUserIds.add(session.userId);
        }
        if (selfId) usedSessionIds.add(selfId);

        const nextLive = [...live];
        let placed = 0;
        for (const session of data.sessions ?? []) {
          if (placed >= emptyIndexes.length) break;
          if (usedSessionIds.has(session.sessionId)) continue;
          if (usedUserIds.has(session.userId)) continue;
          const slotIndex = emptyIndexes[placed];
          nextLive[slotIndex] = session;
          usedSessionIds.add(session.sessionId);
          usedUserIds.add(session.userId);
          placed += 1;
        }

        if (placed > 0 && !cancelled) {
          setLiveSlots(nextLive);
        }
      } catch {
        /* optional */
      }
    };

    const timer = window.setInterval(() => {
      void fillEmptyWithNewLives();
    }, EMPTY_TILE_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [discoveryEnabled, hasEmptyDiscoveryTile, room.id]);

  const liveSessionForSlot = useCallback(
    (slot: number) => {
      if (!discoveryEnabled) return null;
      if (selfSlotReservedRef.current && slot === 0) return null;
      const session = liveSlots[slot];
      if (!session) return null;
      if (session.sessionId === liveR2SessionIdRef.current) return null;
      return session;
    },
    [discoveryEnabled, liveSlots]
  );

  const archiveSessionForSlot = useCallback(
    (slot: number) => {
      if (!discoveryEnabled) return null;
      if (selfSlotReservedRef.current && slot === 0) return null;
      if (liveSessionForSlot(slot)) return null;
      return archiveSlots[slot] ?? null;
    },
    [archiveSlots, discoveryEnabled, liveSessionForSlot]
  );

  const chunkPreviewForSlot = useCallback(
    (slot: number) => {
      const live = liveSessionForSlot(slot);
      if (live) {
        return {
          r2Folder: live.r2Folder,
          lastChunkNumber: live.lastChunkNumber,
          mode: "live" as const,
          onDead: () => {
            void replaceLiveSlot(slot, live.sessionId);
          }
        };
      }
      const archive = archiveSessionForSlot(slot);
      if (!archive) return null;
      return {
        r2Folder: archive.r2Folder,
        lastChunkNumber: archive.lastChunkNumber,
        mode: "archive" as const
      };
    },
    [archiveSessionForSlot, liveSessionForSlot, replaceLiveSlot]
  );

  const toggleGoLive = () => {
    if (isLive || isGoingLive) {
      stopCamera();
      return;
    }
    void startCamera();
  };

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onLeave();
    };

    syncFullscreen();
    document.body.style.overflow = "hidden";
    document.addEventListener("fullscreenchange", syncFullscreen);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      stopCamera();
      void exitFullscreen();
      document.body.style.overflow = "";
      document.removeEventListener("fullscreenchange", syncFullscreen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onLeave, stopCamera]);

  return (
    <div
      className={`live-rooms-immersive${blurred ? " is-blurred" : ""}`}
      aria-hidden={blurred || undefined}
    >
      <header className="live-rooms-immersive-header">
        <button
          className={`live-rooms-immersive-action${isLive ? " live-rooms-immersive-action--live" : ""}`}
          disabled={isGoingLive || staticPreviewOnly}
          onClick={toggleGoLive}
          type="button"
        >
          {isGoingLive ? "Starting…" : isLive ? "End Live" : "Go Live"}
        </button>
        <div className="live-rooms-immersive-title-wrap">
          <button
            type="button"
            className="live-rooms-immersive-nav"
            aria-label="Previous lives"
            onClick={showPreviousSet}
          >
            &lt;
          </button>
          <h1 className="live-rooms-immersive-title">
            {room.title}
            {tier === "free" && remainingSeconds !== null ? (
              <span className="live-rooms-immersive-quota">
                {" "}
                · {formatRemainingTime(remainingSeconds)}
              </span>
            ) : null}
          </h1>
          <button
            type="button"
            className="live-rooms-immersive-nav"
            aria-label="Next lives"
            onClick={showNextSet}
          >
            &gt;
          </button>
        </div>
        <div className="live-rooms-immersive-header-actions">
          <button
            type="button"
            className="live-rooms-immersive-fullscreen"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Go fullscreen"}
            onClick={() => {
              void toggleFullscreen();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              {isFullscreen ? (
                <path
                  d="M9 4.75H5.75A1.75 1.75 0 0 0 4 6.5v3.25M15 4.75h3.25A1.75 1.75 0 0 1 20 6.5v3.25M9 19.25H5.75A1.75 1.75 0 0 1 4 17.5v-3.25M15 19.25h3.25A1.75 1.75 0 0 0 20 17.5v-3.25"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M8.25 4.75H6.5A1.75 1.75 0 0 0 4.75 6.5v1.75M15.75 4.75H17.5A1.75 1.75 0 0 1 19.25 6.5v1.75M8.25 19.25H6.5A1.75 1.75 0 0 1 4.75 17.5v-1.75M15.75 19.25H17.5A1.75 1.75 0 0 0 19.25 17.5v-1.75"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>
          <button
            className="live-rooms-immersive-action"
            onClick={onLeave}
            type="button"
          >
            Leave Room
          </button>
        </div>
      </header>

      {viewTimerPercent !== null ? (
        <div
          className="live-rooms-view-timer"
          role="progressbar"
          aria-label="Guest view time remaining"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(viewTimerPercent)}
        >
          <div
            className="live-rooms-view-timer-fill"
            style={{ width: `${viewTimerPercent}%` }}
          />
        </div>
      ) : null}

      <div className="live-rooms-immersive-body">
        <div className="live-rooms-immersive-main-column">
          <div className="live-rooms-immersive-pinned">
            {layout.main.map((feed, index) => {
              const isSelfSlot = isLive && index === selfMainSlot;
              const archiveSlot = index === 0 ? 0 : 1;
              const liveSession = isSelfSlot
                ? null
                : liveSessionForSlot(archiveSlot);
              const archiveSession = isSelfSlot
                ? null
                : archiveSessionForSlot(archiveSlot);
              const chunkPreview = isSelfSlot
                ? null
                : chunkPreviewForSlot(archiveSlot);
              const tileLabel =
                liveSession?.displayName?.trim() ||
                archiveSession?.displayName?.trim() ||
                feed.name;
              const tileAuthor =
                liveSession?.author ?? archiveSession?.author ?? null;

              return (
                <div
                  aria-label={isSelfSlot ? "Your live feed" : tileLabel}
                  className="live-rooms-preview-tile live-rooms-immersive-pinned-tile"
                  key={`pinned-${room.id}-${liveSetIndex}-${feed.name}-${index}`}
                  role="group"
                >
                  {isSelfSlot ? (
                    <>
                      <video
                        autoPlay
                        className="live-rooms-featured-video"
                        muted
                        playsInline
                        ref={attachStreamToVideo}
                      />
                      <span className="live-rooms-featured-label">You</span>
                    </>
                  ) : chunkPreview ? (
                    <ChunkPreviewPlayer
                      className="live-rooms-featured-hls"
                      initialLastChunk={chunkPreview.lastChunkNumber}
                      label={tileLabel}
                      mode={chunkPreview.mode}
                      onDead={chunkPreview.onDead}
                      paused={pauseIncoming}
                      r2Folder={chunkPreview.r2Folder}
                    />
                  ) : (
                    <Image
                      alt=""
                      className="live-rooms-featured-image"
                      fill
                      priority={index === 0}
                      sizes="(max-width: 960px) 50vw, 38vw"
                      src={feed.image}
                    />
                  )}
                  {!isSelfSlot ? (
                    <TileUserLabel
                      author={tileAuthor}
                      label={tileLabel}
                      variant="featured"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          {cameraError ? (
            <p className="live-rooms-camera-error" role="alert">
              {cameraError}
            </p>
          ) : null}

          <div className="live-rooms-immersive-bottom">
            <div className="live-rooms-immersive-bottom-grid">
              {(isMobileViewport
                ? layout.bottom.slice(0, 2)
                : layout.bottom
              ).map((participant, index) => {
                const slot = 2 + index;
                const liveSession = liveSessionForSlot(slot);
                const archiveSession = archiveSessionForSlot(slot);
                const chunkPreview = chunkPreviewForSlot(slot);
                const tileLabel =
                  liveSession?.displayName?.trim() ||
                  archiveSession?.displayName?.trim() ||
                  participant.name;
                const tileAuthor =
                  liveSession?.author ?? archiveSession?.author ?? null;

                return (
                  <LiveTile
                    author={tileAuthor}
                    chunkPreview={chunkPreview}
                    className="live-rooms-immersive-bottom-tile"
                    image={participant.image}
                    key={`grid-${room.id}-${liveSetIndex}-${participant.name}-${index}`}
                    label={tileLabel}
                    labelPosition="center"
                    sizes="(max-width: 960px) 50vw, 180px"
                    paused={pauseIncoming}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {!isMobileViewport ? (
          <div className="live-rooms-immersive-rail">
            {layout.rail.map((participant, index) => {
              const slot = 6 + index;
              const liveSession = liveSessionForSlot(slot);
              const archiveSession = archiveSessionForSlot(slot);
              const chunkPreview = chunkPreviewForSlot(slot);
              const tileLabel =
                liveSession?.displayName?.trim() ||
                archiveSession?.displayName?.trim() ||
                participant.name;
              const tileAuthor =
                liveSession?.author ?? archiveSession?.author ?? null;

              return (
                <LiveTile
                  author={tileAuthor}
                  chunkPreview={chunkPreview}
                  className="live-rooms-immersive-rail-tile"
                  image={participant.image}
                  key={`rail-${room.id}-${liveSetIndex}-${participant.name}-${index}`}
                  label={tileLabel}
                  sizes="200px"
                  paused={pauseIncoming}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PrivateRoomComingSoonModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="room-coming-soon-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="room-coming-soon-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-coming-soon-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="room-coming-soon-title">Coming Soon 🚀</h3>
        <p>
          Private Sessions will let trainers and gyms host invitation-only live
          workouts, coaching sessions, and fitness classes.
        </p>
        <p className="room-coming-soon-stay">Stay tuned.</p>
        <div className="room-coming-soon-actions">
          <button
            type="button"
            className="room-coming-soon-btn"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveRoomsExperience() {
  const supabase = useMemo(() => createClient(), []);
  const {
    tier,
    remainingSeconds,
    setTier,
    setRemainingSeconds
  } = useEntitlements();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<LobbyMessageView[]>([]);
  const [chatMinimized, setChatMinimized] = useState(true);
  const [privateRoomModalOpen, setPrivateRoomModalOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(
    null
  );
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const profileCacheRef = useRef(
    new Map<string, Awaited<ReturnType<typeof fetchLobbySenderProfile>>>()
  );

  useEffect(() => {
    if (tier !== "guest") {
      setChatMinimized(false);
    }
  }, [tier]);

  const stubUpgrade = async () => {
    setUpgradeBusy(true);
    try {
      const response = await fetch("/api/billing/stub-upgrade", {
        method: "POST"
      });
      if (!response.ok) throw new Error("Upgrade failed");
      setUpgradeReason(null);
      setTier("premium");
      setRemainingSeconds(null);
    } catch {
      setUpgradeReason("soft_upgrade");
    } finally {
      setUpgradeBusy(false);
    }
  };

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return WORKOUT_ROOMS;

    return WORKOUT_ROOMS.filter((room) =>
      [room.title, room.name, room.description].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    );
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setChatLoading(true);
      setChatError(null);
      try {
        const rows = await listLobbyMessages(supabase);
        if (cancelled) return;
        setMessages(rows);
        for (const row of rows) {
          profileCacheRef.current.set(row.senderId, {
            id: row.senderId,
            display_name: row.author === "Athlete" ? null : row.author,
            username: row.handle.startsWith("@")
              ? row.handle.slice(1)
              : row.handle,
            avatar_url: row.avatar
          });
        }
      } catch (caught) {
        if (!cancelled) {
          setChatError(
            caught instanceof Error
              ? caught.message
              : "Could not load lobby chat."
          );
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };

    void load();

    const channel = supabase
      .channel("lobby-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lobby_messages"
        },
        (payload) => {
          const row = payload.new as DbLobbyMessage;
          void (async () => {
            let profile = profileCacheRef.current.get(row.sender_id) ?? null;
            if (!profile) {
              try {
                profile = await fetchLobbySenderProfile(
                  supabase,
                  row.sender_id
                );
                if (profile) {
                  profileCacheRef.current.set(row.sender_id, profile);
                }
              } catch {
                profile = null;
              }
            }

            const view = mapDbLobbyMessageToView(row, profile);
            setMessages((prev) => {
              if (prev.some((message) => message.id === view.id)) return prev;
              return [...prev, view];
            });
          })();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (chatMinimized || chatLoading) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMinimized, chatLoading]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || chatSending) return;

    setChatSending(true);
    setChatError(null);
    setDraft("");
    try {
      const created = await sendLobbyMessage(supabase, text);
      profileCacheRef.current.set(created.senderId, {
        id: created.senderId,
        display_name: created.author === "Athlete" ? null : created.author,
        username: created.handle.startsWith("@")
          ? created.handle.slice(1)
          : created.handle,
        avatar_url: created.avatar
      });
      setMessages((prev) => {
        if (prev.some((message) => message.id === created.id)) return prev;
        return [...prev, created];
      });
    } catch (caught) {
      setDraft(text);
      setChatError(
        caught instanceof Error ? caught.message : "Could not send message."
      );
    } finally {
      setChatSending(false);
    }
  };

  return (
    <div className="room-select-page">
      <AppNav variant="rooms" />

      <div
        className={`room-select-shell${
          chatMinimized || tier === "guest" ? " is-chat-minimized" : ""
        }`}
      >
        <div className="room-select-main">
          <label className="room-select-search">
            <span className="sr-only">Filter rooms</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter / filter / search..."
              type="search"
              value={query}
            />
          </label>

          {tier !== "guest" ? (
            <p className="room-select-quota">
              {formatRemainingTime(remainingSeconds)}
              {tier === "free" ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="room-select-upgrade-link"
                    onClick={() => setUpgradeReason("soft_upgrade")}
                  >
                    Go Premium
                  </button>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="room-select-grid">
            {filteredRooms.map((room) => {
              const locked = !canAccessRoom(tier, room.id);
              if (locked) {
                return (
                  <div
                    className="room-select-card is-locked"
                    key={room.id}
                  >
                    <div className="room-select-card-media">
                      <Image
                        alt=""
                        className="room-select-card-image"
                        fill
                        sizes="(max-width: 960px) 50vw, 280px"
                        src={room.coverImage}
                      />
                    </div>
                    <div className="room-select-card-body">
                      <strong>{room.title}</strong>
                      <span>Locked</span>
                    </div>
                    <button
                      type="button"
                      className="room-select-card-lock"
                      onClick={() => setUpgradeReason("locked_room")}
                    >
                      <strong>Sign in to unlock</strong>
                      <span>Guests can try {GUEST_ROOM_ID}</span>
                    </button>
                  </div>
                );
              }

              return (
              <Link
                className="room-select-card"
                href={`/rooms/${room.id}`}
                key={room.id}
              >
                <div className="room-select-card-media">
                  <Image
                    alt=""
                    className="room-select-card-image"
                    fill
                    sizes="(max-width: 960px) 50vw, 280px"
                    src={room.coverImage}
                  />
                </div>
                <div className="room-select-card-body">
                  <strong>{room.title}</strong>
                  <span className="room-select-live-count">
                    <span className="room-select-live-dot" aria-hidden />
                    {room.liveCount} Live
                  </span>
                  <div className="room-select-avatars">
                    {room.participants.slice(0, 3).map((participant) => (
                      <span className="room-select-avatar" key={`${room.id}-${participant.name}`}>
                        <Image
                          alt=""
                          className="room-select-avatar-image"
                          fill
                          sizes="28px"
                          src={participant.image}
                        />
                      </span>
                    ))}
                    <span className="room-select-avatar room-select-avatar-more">…</span>
                  </div>
                </div>
              </Link>
              );
            })}

            {!query.trim() ? (
              <button
                className="room-select-card room-select-card--create"
                type="button"
                onClick={() => setPrivateRoomModalOpen(true)}
              >
                <div className="room-select-create-media">
                  <span className="room-select-create-plus" aria-hidden>
                    +
                  </span>
                </div>
                <div className="room-select-card-body">
                  <strong>Create Private Session</strong>
                  <span>Invite-Only</span>
                </div>
              </button>
            ) : null}
          </div>

          {filteredRooms.length === 0 ? (
            <p className="room-select-empty">No rooms match that search.</p>
          ) : null}
        </div>

        {chatMinimized || tier === "guest" ? (
          <button
            type="button"
            className="room-select-chat-restore"
            aria-label="Expand chat"
            title="Expand chat"
            onClick={() => {
              if (tier === "guest") {
                setUpgradeReason("guest_feed_end");
                return;
              }
              setChatMinimized(false);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden fill="none">
              <path
                d="M5.75 6.75h12.5A2 2 0 0 1 20.25 8.75v6.5a2 2 0 0 1-2 2H11l-3.75 2.5V17.25h-1.5a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
            <span>Chat</span>
          </button>
        ) : (
          <aside className="room-select-chat">
            <div className="room-select-chat-header">
              <strong>Lobby Chat</strong>
              <button
                type="button"
                className="room-select-chat-minimize"
                aria-label="Minimize chat"
                title="Minimize chat"
                onClick={() => setChatMinimized(true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden fill="none">
                  <path
                    d="M6 12h12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="room-select-chat-list">
              {chatLoading ? (
                <p className="room-select-chat-status">Loading messages…</p>
              ) : null}
              {!chatLoading && messages.length === 0 ? (
                <p className="room-select-chat-status">
                  No messages yet. Say hello to the lobby.
                </p>
              ) : null}
              {messages.map((message) => (
                <article className="room-select-chat-item" key={message.id}>
                  <div className="room-select-chat-top">
                    <span className="room-select-chat-avatar">
                      <Image
                        alt=""
                        className="room-select-avatar-image"
                        fill
                        sizes="36px"
                        src={message.avatar}
                        unoptimized={isRemoteSrc(message.avatar)}
                      />
                    </span>
                    <div>
                      <p className="room-select-chat-author">{message.author}</p>
                      <p className="room-select-chat-handle">{message.handle}</p>
                    </div>
                  </div>
                  <p className="room-select-chat-text">{message.text}</p>
                  <time
                    className="room-select-chat-tag"
                    dateTime={message.createdAt}
                  >
                    {formatLobbyRelativeTime(message.createdAt)}
                  </time>
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
            {chatError ? (
              <p className="room-select-chat-error">{chatError}</p>
            ) : null}
            <form
              className="room-select-chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <label className="sr-only" htmlFor="room-chat-input">
                Type a message
              </label>
              <textarea
                id="room-chat-input"
                className="room-select-chat-input"
                maxLength={LOBBY_MESSAGE_MAX_LENGTH}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Message the lobby…"
                rows={2}
                value={draft}
                disabled={chatSending}
              />
              <button
                className="room-select-chat-send"
                type="submit"
                disabled={!draft.trim() || chatSending}
              >
                {chatSending ? "…" : "Send"}
              </button>
            </form>
          </aside>
        )}
      </div>

      {privateRoomModalOpen ? (
        <PrivateRoomComingSoonModal
          onClose={() => setPrivateRoomModalOpen(false)}
        />
      ) : null}

      <UpgradePrompt
        open={Boolean(upgradeReason)}
        reason={upgradeReason ?? "locked_room"}
        busy={upgradeBusy}
        onClose={() => setUpgradeReason(null)}
        onStubUpgrade={stubUpgrade}
      />
    </div>
  );
}
