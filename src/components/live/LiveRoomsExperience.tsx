"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/app/landing.css";
import "@/app/live-rooms.css";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { exitFullscreen, toggleFullscreen } from "@/lib/fullscreen";
import { LIVE_IMAGES } from "@/lib/live-images";
import {
  getRoomLiveSets,
  WORKOUT_ROOMS,
  type RoomLiveSet,
  type WorkoutRoom
} from "@/lib/rooms";

type PreviewZone = "main" | "bottom" | "rail";

function cloneLiveSet(set: RoomLiveSet): RoomLiveSet {
  return {
    main: [set.main[0], set.main[1]],
    bottom: [set.bottom[0], set.bottom[1], set.bottom[2], set.bottom[3]],
    rail: [set.rail[0], set.rail[1], set.rail[2], set.rail[3], set.rail[4]]
  };
}

const CHAT_MESSAGES = [
  {
    id: "1",
    author: "Jordan",
    handle: "@jordan_lifts",
    avatar: LIVE_IMAGES.participant6,
    text: "6 months of showing up. Same person, stronger habits.",
    hashtag: "#Accountability"
  },
  {
    id: "2",
    author: "Maya",
    handle: "@maya_moves",
    avatar: LIVE_IMAGES.sidebar2,
    text: "Who’s joining Sunrise Yoga Flow?",
    hashtag: "#yoga"
  },
  {
    id: "3",
    author: "Alex",
    handle: "@alex_runs",
    avatar: LIVE_IMAGES.participant1,
    text: "Just crushed HIIT Circuit. Legs are toast.",
    hashtag: "#hiit"
  }
];

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLive(false);
    setIsGoingLive(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported in this browser.");
      return;
    }

    setIsGoingLive(true);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: false
      });

      streamRef.current = stream;
      setIsLive(true);
      attachStreamToVideo(videoRef.current);
    } catch (error) {
      stopCamera();
      setCameraError(
        error instanceof Error
          ? error.message
          : "Could not access your camera. Check permissions and try again."
      );
    } finally {
      setIsGoingLive(false);
    }
  }, [attachStreamToVideo, stopCamera]);

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

              return (
                <button
                  aria-label={showSelf ? "Move your live feed" : `Focus ${feed.name}`}
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
                  <span className="live-rooms-featured-label">
                    {showSelf ? "You" : feed.name}
                  </span>
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

export function LiveRoomsExperience() {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(CHAT_MESSAGES);

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return WORKOUT_ROOMS;

    return WORKOUT_ROOMS.filter((room) =>
      [room.title, room.name, room.description].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    );
  }, [query]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        author: "You",
        handle: "@you",
        avatar: LIVE_IMAGES.participant4,
        text,
        hashtag: "#live"
      }
    ]);
    setDraft("");
  };

  return (
    <div className="room-select-page">
      <header className="room-select-nav">
        <Link className="landing-logo" href="/">
          <span className="landing-logo-mark" aria-hidden>
            S
          </span>
          Satara
        </Link>
        <div className="room-select-nav-actions">
          <ThemeSwitch />
          <Link className="btn-secondary" href="/feed">
            Feed
          </Link>
          <Link className="btn-primary" href="/profile">
            Profile
          </Link>
        </div>
      </header>

      <div className="room-select-shell">
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
              <button className="room-select-card room-select-card--create" type="button">
                <div className="room-select-create-media">
                  <span className="room-select-create-plus" aria-hidden>
                    +
                  </span>
                </div>
                <div className="room-select-card-body">
                  <strong>Create Private Room</strong>
                  <span>Invite-only session</span>
                </div>
              </button>
            ) : null}
          </div>

          {filteredRooms.length === 0 ? (
            <p className="room-select-empty">No rooms match that search.</p>
          ) : null}
        </div>

        <aside className="room-select-chat">
          <div className="room-select-chat-header">
            <strong>Chat</strong>
            <span aria-hidden>—</span>
          </div>
          <div className="room-select-chat-list">
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
                    />
                  </span>
                  <div>
                    <p className="room-select-chat-author">{message.author}</p>
                    <p className="room-select-chat-handle">{message.handle}</p>
                  </div>
                </div>
                <p className="room-select-chat-text">{message.text}</p>
                <span className="room-select-chat-tag">{message.hashtag}</span>
              </article>
            ))}
          </div>
          <form
            className="room-select-chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <label className="sr-only" htmlFor="room-chat-input">
              Type a message
            </label>
            <textarea
              id="room-chat-input"
              className="room-select-chat-input"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message…"
              rows={2}
              value={draft}
            />
            <button className="room-select-chat-send" type="submit" disabled={!draft.trim()}>
              Send
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
