/** Bump when replacing files under public/images/live to invalidate next/image cache. */
const IMAGE_CACHE_VERSION = "4";

function liveImage(path: string) {
  return `${path}?v=${IMAGE_CACHE_VERSION}`;
}

export const LIVE_IMAGES = {
  main: liveImage("/images/live/main.png"),
  participant1: liveImage("/images/live/participant-1.png"),
  participant2: liveImage("/images/live/participant-2.png"),
  participant3: liveImage("/images/live/participant-3.png"),
  participant4: liveImage("/images/live/participant-4.png"),
  participant5: liveImage("/images/live/participant-5.png"),
  participant6: liveImage("/images/live/participant-6.png"),
  participant7: liveImage("/images/live/participant-7.png"),
  participant8: liveImage("/images/live/participant-8.png"),
  sidebar1: liveImage("/images/live/sidebar-1.png"),
  sidebar2: liveImage("/images/live/sidebar-2.jpg"),
  sidebar3: liveImage("/images/live/sidebar-3.png"),
  transformBefore: liveImage("/images/landing/transform-before.png"),
  transformAfter: liveImage("/images/landing/transform-after.png"),
  pumpCheck: liveImage("/images/landing/pump-check.png"),
  fitCheck: liveImage("/images/landing/fit-check.png"),
  mealPrep: liveImage("/images/landing/meal-prep.png"),
  dailyWin: liveImage("/images/landing/daily-win.png"),
  accountability: liveImage("/images/landing/accountability.png")
} as const;

export const HERO_PARTICIPANTS = [
  { name: "Alex", image: LIVE_IMAGES.participant1 },
  { name: "Jordan", image: LIVE_IMAGES.participant2 },
  { name: "You", image: LIVE_IMAGES.participant4 },
  { name: "Sam", image: LIVE_IMAGES.participant3 },
  { name: "Casey", image: LIVE_IMAGES.participant5 },
  { name: "George", image: LIVE_IMAGES.participant6 },
  { name: "Chris", image: LIVE_IMAGES.participant7 },
  { name: "Morgan", image: LIVE_IMAGES.participant8 }
];

export const HERO_SIDEBAR_LIVE = [
  { name: "Riley", image: LIVE_IMAGES.sidebar1 },
  { name: "Maya", image: LIVE_IMAGES.sidebar2 },
  { name: "Taylor", image: LIVE_IMAGES.sidebar3 }
];

export const ROOM_LIVE_IMAGES: Record<string, string> = {
  yoga: LIVE_IMAGES.participant2,
  workout: LIVE_IMAGES.participant3,
  cardio: LIVE_IMAGES.participant1,
  zumba: LIVE_IMAGES.main,
  meditation: LIVE_IMAGES.participant4
};
