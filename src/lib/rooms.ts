import { HERO_PARTICIPANTS, HERO_SIDEBAR_LIVE, LIVE_IMAGES } from "@/lib/live-images";

export type RoomId =
  | "yoga"
  | "cardio"
  | "zumba"
  | "workout"
  | "meditation";

export type LiveParticipant = {
  name: string;
  image: string;
};

export type WorkoutRoom = {
  id: RoomId;
  icon: string;
  name: string;
  title: string;
  description: string;
  liveCount: number;
  roomNumber: number;
  coverImage: string;
  pinnedFeeds: [LiveParticipant, LiveParticipant];
  participants: LiveParticipant[];
  sidebarParticipants: LiveParticipant[];
  gridParticipants: LiveParticipant[];
};

const BASE_PARTICIPANTS: LiveParticipant[] = [
  ...HERO_PARTICIPANTS,
  ...HERO_SIDEBAR_LIVE
];

const SIDEBAR_PARTICIPANTS: LiveParticipant[] = [
  ...HERO_SIDEBAR_LIVE,
  { name: "Jordan", image: HERO_PARTICIPANTS[1].image },
  { name: "Alex", image: HERO_PARTICIPANTS[0].image },
  { name: "Sam", image: HERO_PARTICIPANTS[3].image }
];

function extendParticipants(pool: LiveParticipant[], count: number): LiveParticipant[] {
  return Array.from({ length: count }, (_, index) => pool[index % pool.length]);
}

function participantsForRoom(offset: number): LiveParticipant[] {
  const pool = [...BASE_PARTICIPANTS];
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, 8);
}

function sidebarForRoom(offset: number): LiveParticipant[] {
  const pool = [...SIDEBAR_PARTICIPANTS];
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated;
}

function gridForRoom(offset: number): LiveParticipant[] {
  const pool = [...HERO_PARTICIPANTS];
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return extendParticipants(rotated, 16);
}

function pinnedFeedsForRoom(offset: number): [LiveParticipant, LiveParticipant] {
  const pool = [{ name: "Coach", image: LIVE_IMAGES.main }, ...HERO_PARTICIPANTS];
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return [rotated[0], rotated[1]];
}

function avatarsForRoom(offset: number): LiveParticipant[] {
  return participantsForRoom(offset).slice(0, 4);
}

export const WORKOUT_ROOMS: WorkoutRoom[] = [
  {
    id: "yoga",
    icon: "🧘",
    name: "Yoga",
    title: "Yoga",
    description: "Stretch, breathe, and flow together.",
    liveCount: 28,
    roomNumber: 1,
    coverImage: LIVE_IMAGES.participant2,
    pinnedFeeds: pinnedFeedsForRoom(1),
    participants: avatarsForRoom(1),
    sidebarParticipants: sidebarForRoom(2),
    gridParticipants: gridForRoom(1)
  },
  {
    id: "cardio",
    icon: "🏃",
    name: "Cardio",
    title: "Cardio",
    description: "High-energy sweat sessions.",
    liveCount: 41,
    roomNumber: 2,
    coverImage: LIVE_IMAGES.participant1,
    pinnedFeeds: pinnedFeedsForRoom(4),
    participants: avatarsForRoom(4),
    sidebarParticipants: sidebarForRoom(3),
    gridParticipants: gridForRoom(4)
  },
  {
    id: "zumba",
    icon: "💃",
    name: "Zumba",
    title: "Zumba",
    description: "Dance cardio with the room.",
    liveCount: 33,
    roomNumber: 3,
    coverImage: LIVE_IMAGES.participant5,
    pinnedFeeds: pinnedFeedsForRoom(6),
    participants: avatarsForRoom(6),
    sidebarParticipants: sidebarForRoom(4),
    gridParticipants: gridForRoom(6)
  },
  {
    id: "workout",
    icon: "💪",
    name: "Workout",
    title: "Workout",
    description: "Lifts, conditioning, and form checks.",
    liveCount: 38,
    roomNumber: 4,
    coverImage: LIVE_IMAGES.participant3,
    pinnedFeeds: pinnedFeedsForRoom(2),
    participants: avatarsForRoom(2),
    sidebarParticipants: sidebarForRoom(1),
    gridParticipants: gridForRoom(2)
  },
  {
    id: "meditation",
    icon: "🧠",
    name: "Meditation",
    title: "Meditation",
    description: "Recover and reset as a group.",
    liveCount: 19,
    roomNumber: 5,
    coverImage: LIVE_IMAGES.participant4,
    pinnedFeeds: pinnedFeedsForRoom(3),
    participants: avatarsForRoom(3),
    sidebarParticipants: sidebarForRoom(5),
    gridParticipants: gridForRoom(3)
  }
];

export const DEFAULT_ROOM_ID: RoomId = "yoga";

export function getRoomById(roomId: RoomId): WorkoutRoom {
  return WORKOUT_ROOMS.find((room) => room.id === roomId) ?? WORKOUT_ROOMS[0];
}
