"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { HERO_PARTICIPANTS, LIVE_IMAGES } from "@/lib/live-images";
import {
  hasLandingHeroVideos,
  landingHeroVideosForRoom
} from "@/lib/landing-hero-videos";
import { getRoomById, type RoomId } from "@/lib/rooms";

const ROOM_TAGS = [
  { label: "Workout", roomId: "workout" as RoomId },
  { label: "Yoga", roomId: "yoga" as RoomId },
  { label: "Zumba", roomId: "zumba" as RoomId }
] as const;

function shuffleItems<T>(items: readonly T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index]
    ];
  }
  return shuffled;
}

export function HeroLivePreview() {
  const [activeLabel, setActiveLabel] = useState<(typeof ROOM_TAGS)[number]["label"]>(
    "Workout"
  );
  /** Client-only shuffle per room — avoids SSR/client Math.random mismatch. */
  const [shuffledByRoom, setShuffledByRoom] = useState<
    Partial<Record<RoomId, readonly string[]>>
  >({});

  const room = useMemo(() => {
    const tag = ROOM_TAGS.find((item) => item.label === activeLabel) ?? ROOM_TAGS[0];
    return getRoomById(tag.roomId);
  }, [activeLabel]);

  const orderedVideos = useMemo(
    () => landingHeroVideosForRoom(room.id),
    [room.id]
  );

  useEffect(() => {
    setShuffledByRoom((prev) => {
      if (prev[room.id]) return prev;
      return {
        ...prev,
        [room.id]: shuffleItems(landingHeroVideosForRoom(room.id))
      };
    });
  }, [room.id]);

  const coach = room.pinnedFeeds[0] ?? { name: "Coach", image: LIVE_IMAGES.main };
  const avatars = room.participants.slice(0, 5);
  const sidebar = room.sidebarParticipants.slice(0, 3);
  const heroVideos = shuffledByRoom[room.id] ?? orderedVideos;
  const useHeroVideos = hasLandingHeroVideos(room.id);

  return (
    <div className="hero-mock-wrap">
      <div aria-hidden className="hero-mock-backdrop" />
      <div className="hero-room-tags" role="tablist" aria-label="Room types">
        {ROOM_TAGS.map((tag) => {
          const isActive = tag.label === activeLabel;
          return (
            <button
              key={tag.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`hero-room-tag${isActive ? " hero-room-tag--active" : ""}`}
              onClick={() => setActiveLabel(tag.label)}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
      <div className="hero-mock" aria-live="polite">
        <div className="hero-mock-header">
          <span>← Back</span>
          <strong>
            {room.title}
          </strong>
          <span className="hero-mock-live-count">{room.liveCount} live</span>
        </div>
        <div className="hero-mock-body">
          <div className="hero-mock-main">
            <div className="hero-mock-video">
              {useHeroVideos && heroVideos[0] ? (
                <video
                  key={`${room.id}-main-${heroVideos[0]}`}
                  autoPlay
                  className="hero-mock-video-image"
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  src={heroVideos[0]}
                />
              ) : (
                <Image
                  alt=""
                  className="hero-mock-video-image"
                  fill
                  priority
                  sizes="(max-width: 960px) 100vw, 560px"
                  src={room.coverImage}
                />
              )}
              <span className="hero-mock-live-badge">● Live</span>
              <span className="hero-mock-tile-label">{coach.name}</span>
            </div>
            <div className="hero-mock-avatars">
              {(avatars.length ? avatars : HERO_PARTICIPANTS.slice(0, 5)).map(
                (participant) => (
                  <div className="hero-mock-avatar" key={`${room.id}-${participant.name}`}>
                    <div className="hero-mock-avatar-media">
                      <Image
                        alt=""
                        className="hero-mock-avatar-image"
                        fill
                        sizes="52px"
                        src={participant.image}
                      />
                    </div>
                    <span>{participant.name}</span>
                  </div>
                )
              )}
            </div>
          </div>
          <div className="hero-mock-sidebar">
            {sidebar.map((participant, index) => {
              const videoSrc = heroVideos[index + 1];
              return (
                <div
                  className="hero-mock-sidebar-tile"
                  key={`${room.id}-side-${participant.name}`}
                >
                  {useHeroVideos && videoSrc ? (
                    <video
                      key={`${room.id}-side-${index}-${videoSrc}`}
                      autoPlay
                      className="hero-mock-sidebar-tile-image"
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      src={videoSrc}
                    />
                  ) : (
                    <Image
                      alt=""
                      className="hero-mock-sidebar-tile-image"
                      fill
                      sizes="160px"
                      src={participant.image}
                    />
                  )}
                  <span className="hero-mock-live-badge">● Live</span>
                  <span className="hero-mock-tile-label">{participant.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
