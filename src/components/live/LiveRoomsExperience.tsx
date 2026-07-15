"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/app/landing.css";
import "@/app/live-rooms.css";
import { AppNav } from "@/components/nav/AppNav";
import { LiveVideoPlayer } from "@/components/live/LiveVideoPlayer";
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

function LiveTile({
  className,
  image,
  label,
  labelPosition = "left",
  priority = false,
  sizes,
  onClick
}: {
  className?: string;
  image: string;
  label: string;
  labelPosition?: "left" | "center";
  priority?: boolean;
  sizes: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={`Focus ${label}`}
      className={`live-rooms-preview-button ${className ?? ""}`}
      onClick={onClick}
      type="button"
    >
      <Image
        alt=""
        className="live-rooms-tile-image"
        fill
        priority={priority}
        sizes={sizes}
        src={image}
      />
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
  onLeave
}: {
  room: WorkoutRoom;
  onLeave: () => void | Promise<void>;
}) {
  const liveSets = useMemo(() => getRoomLiveSets(room), [room]);
  const [liveSetIndex, setLiveSetIndex] = useState(0);
  const [layout, setLayout] = useState<RoomLiveSet>(() =>
    cloneLiveSet(liveSets[0] ?? getRoomLiveSets(room)[0])
  );
  const [selfMainSlot, setSelfMainSlot] = useState<0 | 1>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [playbackHlsUrl, setPlaybackHlsUrl] = useState<string | null>(null);
  const [archiveReplayUrl, setArchiveReplayUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const whipRef = useRef<WhipPublisher | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const activeSet = liveSets[liveSetIndex] ?? liveSets[0];

  useEffect(() => {
    setLayout(cloneLiveSet(activeSet));
    setSelfMainSlot(0);
  }, [liveSetIndex, liveSets]);

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
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;

    void whipRef.current?.stop();
    whipRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPlaybackHlsUrl(null);
    setIsLive(false);
    setIsGoingLive(false);

    if (sessionId) {
      void fetch(`/api/archives/${sessionId}`, { method: "PATCH" })
        .then(async (response) => {
          if (!response.ok) return;
          const data = (await response.json()) as {
            session?: { fileUrl?: string | null };
          };
          if (data.session?.fileUrl) {
            setArchiveReplayUrl(data.session.fileUrl);
          }
        })
        .catch(() => {
          /* Archive finalize is best-effort */
        });
    }
  }, []);

  const startCamera = useCallback(async () => {
    setIsGoingLive(true);
    setCameraError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        throw new Error("Sign in to go live.");
      }

      const sessionResponse = await fetch("/api/archives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id })
      });
      if (!sessionResponse.ok) {
        const data = (await sessionResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Could not start archive session.");
      }
      const sessionData = (await sessionResponse.json()) as {
        session: { id: string };
      };
      sessionIdRef.current = sessionData.session.id;

      const stream = await captureLiveCamera();
      streamRef.current = stream;
      attachStreamToVideo(videoRef.current);

      const endpoint = whipUrl(room.id, user.id);
      const publisher = await startWhipPublisher({
        stream,
        whipEndpoint: endpoint
      });
      whipRef.current = publisher;

      setPlaybackHlsUrl(hlsUrl(room.id, user.id));
      setArchiveReplayUrl(null);
      setIsLive(true);
    } catch (error) {
      const pendingSession = sessionIdRef.current;
      sessionIdRef.current = null;
      if (pendingSession) {
        void fetch(`/api/archives/${pendingSession}`, { method: "PATCH" });
      }
      stopCamera();
      setCameraError(
        error instanceof Error
          ? error.message
          : "Could not go live. Check camera permissions and that MediaMTX is running."
      );
    } finally {
      setIsGoingLive(false);
    }
  }, [attachStreamToVideo, room.id, stopCamera]);

  useEffect(() => {
    let cancelled = false;

    const loadLatestArchive = async () => {
      try {
        const response = await fetch(
          `/api/archives?roomId=${encodeURIComponent(room.id)}&limit=1`
        );
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as {
          sessions?: { fileUrl?: string | null }[];
        };
        const fileUrl = data.sessions?.[0]?.fileUrl;
        if (fileUrl && !cancelled) {
          setArchiveReplayUrl(fileUrl);
        }
      } catch {
        /* optional */
      }
    };

    void loadLatestArchive();
    return () => {
      cancelled = true;
    };
  }, [room.id]);

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
    <div className="live-rooms-immersive">
      <header className="live-rooms-immersive-header">
        <button
          className={`live-rooms-immersive-action${isLive ? " live-rooms-immersive-action--live" : ""}`}
          disabled={isGoingLive}
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
            {room.title} · Room {room.roomNumber}
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

      <div className="live-rooms-immersive-body">
        <div className="live-rooms-immersive-main-column">
          <div className="live-rooms-immersive-pinned">
            {layout.main.map((feed, index) => {
              const showSelf = isLive && index === selfMainSlot;
              const showHlsLoopback =
                isLive &&
                Boolean(playbackHlsUrl) &&
                index !== selfMainSlot;
              const showArchive =
                !isLive && Boolean(archiveReplayUrl) && index === 1;

              return (
                <button
                  aria-label={
                    showSelf
                      ? "Move your live feed"
                      : showHlsLoopback
                        ? "HLS loopback of your stream"
                        : showArchive
                          ? "Replay last archive"
                          : `Focus ${feed.name}`
                  }
                  className="live-rooms-preview-button live-rooms-immersive-pinned-tile"
                  key={`pinned-${room.id}-${liveSetIndex}-${feed.name}-${index}`}
                  onClick={() => handlePreviewClick("main", index)}
                  type="button"
                >
                  {showSelf ? (
                    <video
                      autoPlay
                      className="live-rooms-featured-video"
                      muted
                      playsInline
                      ref={attachStreamToVideo}
                    />
                  ) : showHlsLoopback && playbackHlsUrl ? (
                    <LiveVideoPlayer
                      className="live-rooms-featured-hls"
                      hlsUrl={playbackHlsUrl}
                      label="You · HLS"
                      muted
                    />
                  ) : showArchive && archiveReplayUrl ? (
                    <LiveVideoPlayer
                      className="live-rooms-featured-hls"
                      label="Archive"
                      muted
                      src={archiveReplayUrl}
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
                  {showHlsLoopback || showArchive ? null : (
                    <span className="live-rooms-featured-label">
                      {showSelf ? "You" : feed.name}
                    </span>
                  )}
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
              {layout.bottom.map((participant, index) => (
                <LiveTile
                  className="live-rooms-immersive-bottom-tile"
                  image={participant.image}
                  key={`grid-${room.id}-${liveSetIndex}-${participant.name}-${index}`}
                  label={participant.name}
                  labelPosition="center"
                  onClick={() => handlePreviewClick("bottom", index)}
                  sizes="(max-width: 960px) 25vw, 180px"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="live-rooms-immersive-rail">
          {layout.rail.map((participant, index) => (
            <LiveTile
              className="live-rooms-immersive-rail-tile"
              image={participant.image}
              key={`rail-${room.id}-${liveSetIndex}-${participant.name}-${index}`}
              label={participant.name}
              onClick={() => handlePreviewClick("rail", index)}
              sizes="200px"
            />
          ))}
        </div>
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
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<LobbyMessageView[]>([]);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [privateRoomModalOpen, setPrivateRoomModalOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const profileCacheRef = useRef(
    new Map<string, Awaited<ReturnType<typeof fetchLobbySenderProfile>>>()
  );

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
          chatMinimized ? " is-chat-minimized" : ""
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

          <div className="room-select-grid">
            {filteredRooms.map((room) => (
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
            ))}

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

        {chatMinimized ? (
          <button
            type="button"
            className="room-select-chat-restore"
            aria-label="Expand chat"
            title="Expand chat"
            onClick={() => setChatMinimized(false)}
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
    </div>
  );
}
