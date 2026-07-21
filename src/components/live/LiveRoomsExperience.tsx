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
import { LiveVideoPlayer } from "@/components/live/LiveVideoPlayer";
import { YouTubePreviewEmbed } from "@/components/live/YouTubePreviewEmbed";
import "@/app/billing.css";
import {
  canAccessRoom,
  formatRemainingTime,
  GUEST_ROOM_ID,
  type Tier,
  type UpgradeReason
} from "@/lib/entitlements";
import { guestPreviewYoutubeId } from "@/lib/guest-preview-videos";
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
import { PREVIEW_DEV_BROADCASTER_ID, PREVIEW_PRIMARY_ROOM_ID } from "@/lib/streaming/preview-chunks";
import { hlsUrl, whipUrl } from "@/lib/streaming/config";
import {
  startWhipPublisher,
  type WhipPublisher
} from "@/lib/streaming/whip-publisher";
import { createClient } from "@/lib/supabase/client";
import type {
  DbLobbyMessage,
  LobbyMessageView
} from "@/lib/types/lobby-chat";
import { LOBBY_MESSAGE_MAX_LENGTH } from "@/lib/types/lobby-chat";

type PreviewZone = "main" | "bottom" | "rail";

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

function LiveTile({
  className,
  image,
  videoSrc,
  youtubeVideoId,
  chunkPreview,
  label,
  labelPosition = "left",
  priority = false,
  sizes,
  paused,
  onClick
}: {
  className?: string;
  image: string;
  /** Looping muted archive clip; falls back to image when missing. */
  videoSrc?: string | null;
  /** Guest muted YouTube preview (preferred over archive when set). */
  youtubeVideoId?: string | null;
  /** Live R2 chunk preview (logged-in workout MVP tile). */
  chunkPreview?: { roomId: string; userId: string } | null;
  label: string;
  labelPosition?: "left" | "center";
  priority?: boolean;
  sizes: string;
  paused?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={`Focus ${label}`}
      className={`live-rooms-preview-button ${className ?? ""}`}
      onClick={onClick}
      type="button"
    >
      {youtubeVideoId ? (
        <YouTubePreviewEmbed
          paused={paused}
          title={`${label} preview`}
          videoId={youtubeVideoId}
        />
      ) : chunkPreview ? (
        <ChunkPreviewPlayer
          className="live-rooms-tile-video"
          paused={paused}
          roomId={chunkPreview.roomId}
          userId={chunkPreview.userId}
        />
      ) : videoSrc ? (
        <LiveVideoPlayer
          className="live-rooms-tile-video"
          loop
          muted
          paused={paused}
          src={videoSrc}
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
      <span
        className={`live-rooms-tile-label${labelPosition === "center" ? " live-rooms-tile-label--center" : ""}`}
      >
        {label}
      </span>
    </button>
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
  /** Force static images only (no YouTube / archives) — used when view limit hits. */
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
  const [hlsReady, setHlsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [playbackHlsUrl, setPlaybackHlsUrl] = useState<string | null>(null);
  const [archiveUrls, setArchiveUrls] = useState<string[]>([]);
  const [tabHidden, setTabHidden] = useState(false);
  const [viewTimerPercent, setViewTimerPercent] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const whipRef = useRef<WhipPublisher | null>(null);
  const chunkRecorderRef = useRef<ChunkRecorder | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const liveEpochRef = useRef(0);
  const publishGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hlsReadyRef = useRef(false);
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

  const PUBLISH_GRACE_MS = 2.5 * 60 * 1000;

  const archiveForSlot = useCallback(
    (slot: number) => {
      if (archiveUrls.length === 0) return null;
      return archiveUrls[slot % archiveUrls.length] ?? null;
    },
    [archiveUrls]
  );

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
  const useGuestYoutube = tier === "guest" && !staticPreviewOnly;

  const guestYoutubeForSlot = useCallback(
    (slot: number) => guestPreviewYoutubeId(slot),
    []
  );

  const handlePreviewClick = useCallback(
    (zone: PreviewZone, index: number) => {
      if (isLive && zone === "main" && index === selfMainSlot) {
        setSelfMainSlot((slot) => (slot === 0 ? 1 : 0));
        return;
      }

      setLayout((previous) => {
        const next = cloneLiveSet(previous);

        if (zone === "main") {
          const otherIndex = index === 0 ? 1 : 0;
          const current = next.main[index];
          next.main[index] = next.main[otherIndex];
          next.main[otherIndex] = current;
          return next;
        }

        const clicked =
          zone === "bottom" ? next.bottom[index] : next.rail[index];
        const displaced = next.main[1];

        next.main[1] = clicked;
        if (zone === "bottom") {
          next.bottom[index] = displaced;
        } else {
          next.rail[index] = displaced;
        }

        return next;
      });
    },
    [isLive, selfMainSlot]
  );

  const clearPublishGraceTimer = useCallback(() => {
    if (publishGraceTimerRef.current) {
      clearTimeout(publishGraceTimerRef.current);
      publishGraceTimerRef.current = null;
    }
  }, []);

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
    clearPublishGraceTimer();
    hlsReadyRef.current = false;

    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;

    chunkRecorderRef.current?.stop();
    chunkRecorderRef.current = null;

    void whipRef.current?.stop();
    whipRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPlaybackHlsUrl(null);
    setHlsReady(false);
    setIsLive(false);
    setIsGoingLive(false);

    if (sessionId) {
      void fetch(`/api/archives/${sessionId}`, { method: "PATCH" })
        .then(async (response) => {
          if (!response.ok) return;
          const data = (await response.json()) as {
            session?: { fileUrl?: string | null };
          };
          const fileUrl = data.session?.fileUrl;
          if (fileUrl) {
            setArchiveUrls((prev) =>
              prev.includes(fileUrl) ? prev : [fileUrl, ...prev]
            );
          }
        })
        .catch(() => {
          /* Archive finalize is best-effort */
        });
    }
  }, [clearPublishGraceTimer]);

  const startCamera = useCallback(async () => {
    setIsGoingLive(true);
    setCameraError(null);
    setHlsReady(false);
    hlsReadyRef.current = false;
    setPlaybackHlsUrl(null);
    clearPublishGraceTimer();

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
      setIsLive(true);
      setIsGoingLive(false);
      attachStreamToVideo(videoRef.current);

      const useR2Chunks = room.id === PREVIEW_PRIMARY_ROOM_ID;

      // Legacy MediaMTX grace timer — only when publishing via WHIP/HLS.
      if (!useR2Chunks) {
        publishGraceTimerRef.current = setTimeout(() => {
          if (liveEpochRef.current !== epoch) return;
          if (hlsReadyRef.current) return;
          stopCamera();
        }, PUBLISH_GRACE_MS);
      }

      void (async () => {
        if (liveEpochRef.current !== epoch || !streamRef.current) return;

        if (useR2Chunks) {
          chunkRecorderRef.current?.stop();
          chunkRecorderRef.current = startChunkRecorder({
            stream: streamRef.current,
            roomId: room.id,
            onError: (message) => {
              console.warn("[preview-chunks]", message);
            },
            onUploaded: (info) => {
              console.info("[preview-chunks] uploaded", info.key);
            }
          });
          return;
        }

        // Non-workout rooms: keep MediaMTX archive + WHIP until migrated.
        try {
          const sessionResponse = await fetch("/api/archives", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: room.id })
          });
          if (sessionResponse.ok && liveEpochRef.current === epoch) {
            const sessionData = (await sessionResponse.json()) as {
              session: { id: string };
            };
            sessionIdRef.current = sessionData.session.id;
          }
        } catch {
          /* Archive session is best-effort */
        }

        if (liveEpochRef.current !== epoch || !streamRef.current) return;

        try {
          const publisher = await startWhipPublisher({
            stream: streamRef.current,
            whipEndpoint: whipUrl(room.id, user.id)
          });
          if (liveEpochRef.current !== epoch) {
            await publisher.stop();
            return;
          }
          whipRef.current = publisher;
          setPlaybackHlsUrl(hlsUrl(room.id, user.id));
        } catch {
          /* Keep local preview; grace timer ends live if HLS never comes up */
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
    PUBLISH_GRACE_MS,
    attachStreamToVideo,
    clearPublishGraceTimer,
    onNeedSignInToGoLive,
    room.id,
    stopCamera
  ]);

  const handleHlsReady = useCallback(() => {
    hlsReadyRef.current = true;
    setHlsReady(true);
    clearPublishGraceTimer();
  }, [clearPublishGraceTimer]);

  useEffect(() => {
    if (tier === "guest" || staticPreviewOnly) {
      setArchiveUrls([]);
      return;
    }

    let cancelled = false;

    const loadArchives = async () => {
      try {
        const response = await fetch(
          `/api/archives?roomId=${encodeURIComponent(room.id)}&limit=20`
        );
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as {
          sessions?: { fileUrl?: string | null }[];
        };
        const urls = (data.sessions ?? [])
          .map((session) => session.fileUrl)
          .filter((url): url is string => Boolean(url));
        if (!cancelled) {
          setArchiveUrls(urls);
        }
      } catch {
        /* optional */
      }
    };

    void loadArchives();
    return () => {
      cancelled = true;
    };
  }, [room.id, tier, staticPreviewOnly]);

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
              const showLocalPreview = isSelfSlot && !hlsReady;
              const showLiveHls =
                isSelfSlot && hlsReady && Boolean(playbackHlsUrl);
              const archiveSlot = index === 0 ? 0 : 1;
              const archiveSrc = isSelfSlot ? null : archiveForSlot(archiveSlot);

              return (
                <button
                  aria-label={
                    isSelfSlot ? "Move your live feed" : `Focus ${feed.name}`
                  }
                  className="live-rooms-preview-button live-rooms-immersive-pinned-tile"
                  key={`pinned-${room.id}-${liveSetIndex}-${feed.name}-${index}`}
                  onClick={() => handlePreviewClick("main", index)}
                  type="button"
                >
                  {isSelfSlot ? (
                    <>
                      {showLocalPreview ? (
                        <video
                          autoPlay
                          className="live-rooms-featured-video"
                          muted
                          playsInline
                          ref={attachStreamToVideo}
                        />
                      ) : null}
                      {playbackHlsUrl ? (
                        <LiveVideoPlayer
                          className={`live-rooms-featured-hls${
                            showLiveHls ? "" : " is-pending"
                          }`}
                          hlsUrl={playbackHlsUrl}
                          label={showLiveHls ? "You" : undefined}
                          muted
                          onReady={handleHlsReady}
                          suppressErrorDisplay
                        />
                      ) : null}
                      {showLocalPreview ? (
                        <span className="live-rooms-featured-label">You</span>
                      ) : null}
                    </>
                  ) : useGuestYoutube ? (
                    <YouTubePreviewEmbed
                      paused={pauseIncoming}
                      title={`${feed.name} preview`}
                      videoId={guestYoutubeForSlot(archiveSlot)}
                    />
                  ) : archiveSrc ? (
                    <LiveVideoPlayer
                      className="live-rooms-featured-hls"
                      loop
                      muted
                      paused={pauseIncoming}
                      src={archiveSrc}
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
                    <span className="live-rooms-featured-label">
                      {feed.name}
                    </span>
                  ) : null}
                </button>
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
                const showChunkPreview =
                  room.id === PREVIEW_PRIMARY_ROOM_ID &&
                  !useGuestYoutube &&
                  index === 0;

                return (
                  <LiveTile
                    chunkPreview={
                      showChunkPreview
                        ? {
                            roomId: room.id,
                            userId: PREVIEW_DEV_BROADCASTER_ID
                          }
                        : null
                    }
                    className="live-rooms-immersive-bottom-tile"
                    image={participant.image}
                    key={`grid-${room.id}-${liveSetIndex}-${participant.name}-${index}`}
                    label={participant.name}
                    labelPosition="center"
                    onClick={() => handlePreviewClick("bottom", index)}
                    sizes="(max-width: 960px) 50vw, 180px"
                    videoSrc={
                      useGuestYoutube || showChunkPreview
                        ? null
                        : archiveForSlot(2 + index)
                    }
                    youtubeVideoId={
                      useGuestYoutube
                        ? guestYoutubeForSlot(2 + index)
                        : null
                    }
                    paused={pauseIncoming}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {!isMobileViewport ? (
          <div className="live-rooms-immersive-rail">
            {layout.rail.map((participant, index) => (
              <LiveTile
                className="live-rooms-immersive-rail-tile"
                image={participant.image}
                key={`rail-${room.id}-${liveSetIndex}-${participant.name}-${index}`}
                label={participant.name}
                onClick={() => handlePreviewClick("rail", index)}
                sizes="200px"
                videoSrc={useGuestYoutube ? null : archiveForSlot(6 + index)}
                youtubeVideoId={
                  useGuestYoutube ? guestYoutubeForSlot(6 + index) : null
                }
                paused={pauseIncoming}
              />
            ))}
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
