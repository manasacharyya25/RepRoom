import { LIVE_IMAGES } from "@/lib/live-images";

export type FeedImagePost = {
  id: string;
  kind: "image";
  author: string;
  handle: string;
  avatar: string;
  caption: string;
  hashtag: string;
  image: string;
  aspect: "landscape" | "portrait" | "square";
  likes: number;
  comments: number;
};

export type FeedTransformPost = {
  id: string;
  kind: "transform";
  author: string;
  handle: string;
  avatar: string;
  caption: string;
  hashtag: string;
  beforeImage: string;
  afterImage: string;
  likes: number;
  comments: number;
};

export type FeedQuotePost = {
  id: string;
  kind: "quote";
  author: string;
  handle: string;
  avatar: string;
  quote: string;
  likes: number;
  comments: number;
};

export type FeedPost = FeedImagePost | FeedTransformPost | FeedQuotePost;

export const FEED_POSTS: FeedPost[] = [
  {
    id: "meal",
    kind: "image",
    author: "Jordan",
    handle: "@jordan_lifts",
    avatar: LIVE_IMAGES.participant6,
    caption: "Meal prep locked. Consistency over perfection.",
    hashtag: "#mealprep",
    image: LIVE_IMAGES.participant8,
    aspect: "landscape",
    likes: 128,
    comments: 24
  },
  {
    id: "transform",
    kind: "transform",
    author: "Maya",
    handle: "@maya_moves",
    avatar: LIVE_IMAGES.sidebar2,
    caption: "Day 1 → Day 60. Same gym. Different energy.",
    hashtag: "#transformation",
    beforeImage: LIVE_IMAGES.participant2,
    afterImage: LIVE_IMAGES.participant4,
    likes: 342,
    comments: 58
  },
  {
    id: "quote",
    kind: "quote",
    author: "Alex",
    handle: "@alex_runs",
    avatar: LIVE_IMAGES.participant1,
    quote: "There is no finish line — only the community that keeps you going.",
    likes: 96,
    comments: 18
  },
  {
    id: "lift",
    kind: "image",
    author: "Taylor",
    handle: "@taylor_fits",
    avatar: LIVE_IMAGES.participant3,
    caption: "Heavy day. Soft focus. Hard work.",
    hashtag: "#strength",
    image: LIVE_IMAGES.participant3,
    aspect: "portrait",
    likes: 86,
    comments: 12
  },
  {
    id: "fitcheck",
    kind: "image",
    author: "Riley",
    handle: "@riley_eats",
    avatar: LIVE_IMAGES.sidebar1,
    caption: "Fit check before the evening session.",
    hashtag: "#fitcheck",
    image: LIVE_IMAGES.participant4,
    aspect: "portrait",
    likes: 210,
    comments: 31
  },
  {
    id: "pump",
    kind: "image",
    author: "Sam",
    handle: "@sam_sweats",
    avatar: LIVE_IMAGES.participant5,
    caption: "Pump check after HIIT Circuit · Room 4.",
    hashtag: "#accountability",
    image: LIVE_IMAGES.main,
    aspect: "landscape",
    likes: 74,
    comments: 9
  },
  {
    id: "flow",
    kind: "image",
    author: "Chris",
    handle: "@chris_flow",
    avatar: LIVE_IMAGES.participant7,
    caption: "Morning flow with the yoga room.",
    hashtag: "#yoga",
    image: LIVE_IMAGES.participant2,
    aspect: "square",
    likes: 55,
    comments: 7
  },
  {
    id: "quote2",
    kind: "quote",
    author: "Morgan",
    handle: "@morgan_minds",
    avatar: LIVE_IMAGES.participant8,
    quote: "Show up for yourself — the feed will celebrate with you.",
    likes: 141,
    comments: 22
  }
];
