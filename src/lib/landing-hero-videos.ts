import type { RoomId } from "@/lib/rooms";

/** Landing hero tabs that can show looping preview videos. */
export type LandingHeroVideoRoomId = Extract<RoomId, "workout" | "yoga" | "zumba">;

/**
 * MP4 paths under public/videos/landing/{roomId}/.
 * Add entries when new clips are available; empty = fall back to static images.
 */
export const LANDING_HERO_VIDEOS: Record<
  LandingHeroVideoRoomId,
  readonly string[]
> = {
  workout: [
    "/videos/landing/workout/6892973-sd_426_240_25fps.mp4",
    "/videos/landing/workout/11652770-sd_426_240_24fps.mp4",
    "/videos/landing/workout/AC.mp4",
    "/videos/landing/workout/13749258_640_360_24fps.mp4"
  ],
  yoga: [
    "/videos/landing/yoga/A.mp4",
    "/videos/landing/yoga/B.mp4",
    "/videos/landing/yoga/C.mp4",
    "/videos/landing/yoga/D.mp4"
  ],
  zumba: [
    "/videos/landing/zumba/A.mp4",
    "/videos/landing/zumba/B.mp4",
    "/videos/landing/zumba/C.mp4",
    "/videos/landing/zumba/D.mp4"
  ]
};

export function landingHeroVideosForRoom(
  roomId: RoomId
): readonly string[] {
  if (roomId === "workout" || roomId === "yoga" || roomId === "zumba") {
    return LANDING_HERO_VIDEOS[roomId];
  }
  return [];
}

export function hasLandingHeroVideos(roomId: RoomId) {
  return landingHeroVideosForRoom(roomId).length >= 4;
}
