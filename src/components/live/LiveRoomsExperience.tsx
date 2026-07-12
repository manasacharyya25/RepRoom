"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import "@/app/landing.css";
import "@/app/live-rooms.css";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { LIVE_IMAGES } from "@/lib/live-images";
import {
  DEFAULT_ROOM_ID,
  WORKOUT_ROOMS,
  type RoomId,
  type WorkoutRoom
} from "@/lib/rooms";

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
  sizes
}: {
  className?: string;
  image: string;
  label: string;
  labelPosition?: "left" | "center";
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div className={className}>
      <Image
        alt=""
        className="live-rooms-tile-image"
        fill
        priority={priority}
        sizes={sizes}
        src={image}
      />
      <span className="hero-mock-live-badge">LIVE</span>
      <span
        className={`live-rooms-tile-label${labelPosition === "center" ? " live-rooms-tile-label--center" : ""}`}
      >
        {label}
      </span>
    </div>
  );
}

function ImmersiveRoom({
  room,
  onBack
}: {
  room: WorkoutRoom;
  onBack: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onBack]);

  return (
    <div className="live-rooms-immersive">
      <header className="live-rooms-immersive-header">
        <button className="live-rooms-immersive-back" onClick={onBack} type="button">
          ← Back
        </button>
        <h1 className="live-rooms-immersive-title">
          {room.title} · Room {room.roomNumber}
        </h1>
        <span className="live-rooms-immersive-count">{room.liveCount} live</span>
      </header>

      <div className="live-rooms-immersive-body">
        <div className="live-rooms-immersive-stage">
          <div className="live-rooms-immersive-pinned">
            {room.pinnedFeeds.map((feed, index) => (
              <div
                className="live-rooms-immersive-pinned-tile"
                key={`pinned-${room.id}-${feed.name}`}
              >
                <Image
                  alt=""
                  className="live-rooms-featured-image"
                  fill
                  priority={index === 0}
                  sizes="(max-width: 960px) 50vw, 38vw"
                  src={feed.image}
                />
                <span className="hero-mock-live-badge">LIVE</span>
                <span className="live-rooms-featured-label">Pinned · {feed.name}</span>
              </div>
            ))}
          </div>

          <div className="live-rooms-immersive-rail">
            {room.sidebarParticipants.map((participant) => (
              <LiveTile
                className="live-rooms-immersive-rail-tile"
                image={participant.image}
                key={`rail-${room.id}-${participant.name}`}
                label={participant.name}
                sizes="200px"
              />
            ))}
          </div>
        </div>

        <div className="live-rooms-immersive-bottom">
          <div className="live-rooms-immersive-bottom-grid">
            {room.gridParticipants.map((participant, index) => (
              <LiveTile
                className="live-rooms-immersive-bottom-tile"
                image={participant.image}
                key={`grid-${room.id}-${participant.name}-${index}`}
                label={participant.name}
                labelPosition="center"
                sizes="(max-width: 960px) 25vw, 180px"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiveRoomsExperience() {
  const [query, setQuery] = useState("");
  const [activeRoomId, setActiveRoomId] = useState<RoomId | null>(null);

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return WORKOUT_ROOMS;

    return WORKOUT_ROOMS.filter((room) =>
      [room.title, room.name, room.description].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    );
  }, [query]);

  const activeRoom = useMemo(
    () =>
      activeRoomId
        ? (WORKOUT_ROOMS.find((room) => room.id === activeRoomId) ??
          WORKOUT_ROOMS.find((room) => room.id === DEFAULT_ROOM_ID) ??
          WORKOUT_ROOMS[0])
        : null,
    [activeRoomId]
  );

  if (activeRoom) {
    return <ImmersiveRoom onBack={() => setActiveRoomId(null)} room={activeRoom} />;
  }

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
          <Link className="btn-ghost" href="/feed">
            Feed
          </Link>
          <button className="btn-ghost" type="button">
            My Rooms
          </button>
          <Link className="btn-primary" href="/">
            Leave Room
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
              <button
                className="room-select-card"
                key={room.id}
                onClick={() => setActiveRoomId(room.id)}
                type="button"
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
                  <span>{room.liveCount} Live</span>
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
              </button>
            ))}
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
            {CHAT_MESSAGES.map((message) => (
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
        </aside>
      </div>
    </div>
  );
}
