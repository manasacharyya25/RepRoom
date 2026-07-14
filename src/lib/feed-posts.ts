import { LIVE_IMAGES } from "@/lib/live-images";
import type { FeedPostRow } from "@/lib/posts-api";
import {
  formatAgeRange,
  formatCountry,
  formatHoursWorked
} from "@/lib/profile-labels";

export type FeedAuthorPreview = {
  id: string;
  name: string;
  username: string | null;
  handle: string;
  avatar: string;
  ageLabel: string | null;
  countryLabel: string | null;
  hoursLabel: string;
  profileHref: string | null;
};

export type FeedImagePost = {
  id: string;
  kind: "image";
  author: FeedAuthorPreview;
  caption: string;
  hashtag: string;
  image: string;
  aspect: "landscape" | "portrait" | "square";
  likes: number;
  comments: number;
  likedByMe?: boolean;
  createdAtIso?: string;
};

export type FeedTransformPost = {
  id: string;
  kind: "transform";
  author: FeedAuthorPreview;
  caption: string;
  hashtag: string;
  beforeImage: string;
  afterImage: string;
  likes: number;
  comments: number;
  likedByMe?: boolean;
  createdAtIso?: string;
};

export type FeedQuotePost = {
  id: string;
  kind: "quote";
  author: FeedAuthorPreview;
  quote: string;
  likes: number;
  comments: number;
  likedByMe?: boolean;
  createdAtIso?: string;
};

export type FeedPost = FeedImagePost | FeedTransformPost | FeedQuotePost;

function hoursFromGoals(
  goals:
    | {
        template_id: string;
        current_value: number | null;
        target_value: number | null;
      }[]
    | null
    | undefined
) {
  const row = goals?.find((goal) => goal.template_id === "hours_worked");
  return Number(row?.current_value ?? 0);
}

export function authorFromRow(row: FeedPostRow): FeedAuthorPreview {
  const profile = Array.isArray(row.profiles)
    ? row.profiles[0]
    : row.profiles;
  const username = profile?.username?.trim() || null;
  const name = profile?.display_name?.trim() || "Athlete";
  const handle = username ? `@${username}` : "@athlete";
  const avatar = profile?.avatar_url?.trim() || LIVE_IMAGES.participant4;

  return {
    id: row.user_id,
    name,
    username,
    handle,
    avatar,
    ageLabel: formatAgeRange(profile?.age_range),
    countryLabel: formatCountry(profile?.country_code),
    hoursLabel: formatHoursWorked(hoursFromGoals(profile?.goals)),
    profileHref: username ? `/u/${encodeURIComponent(username)}` : null
  };
}

function hashtagFromTags(tags: string[] | null | undefined) {
  const tag = tags?.find((value) => value.trim().length > 0);
  if (!tag) return "";
  return tag.startsWith("#") ? tag : `#${tag}`;
}

export function mapFeedRowToPost(
  row: FeedPostRow,
  likedByMe = false
): FeedPost {
  const author = authorFromRow(row);
  const likes = row.likes_count;
  const comments = row.comments_count;
  const hashtag = hashtagFromTags(row.tags);
  const createdAtIso = row.created_at;

  if (
    row.kind === "transform" &&
    row.before_image_url &&
    row.after_image_url
  ) {
    return {
      id: row.id,
      kind: "transform",
      author,
      caption: row.caption,
      hashtag,
      beforeImage: row.before_image_url,
      afterImage: row.after_image_url,
      likes,
      comments,
      likedByMe,
      createdAtIso
    };
  }

  if (row.category === "motivation" || !row.image_url) {
    return {
      id: row.id,
      kind: "quote",
      author,
      quote: row.caption,
      likes,
      comments,
      likedByMe,
      createdAtIso
    };
  }

  return {
    id: row.id,
    kind: "image",
    author,
    caption: row.caption,
    hashtag,
    image: row.image_url,
    aspect: "portrait",
    likes,
    comments,
    likedByMe,
    createdAtIso
  };
}

export const FEED_POSTS: FeedPost[] = [
  {
    id: "meal",
    kind: "image",
    author: {
      id: "mock-jordan",
      name: "Jordan",
      username: "jordan_lifts",
      handle: "@jordan_lifts",
      avatar: LIVE_IMAGES.participant6,
      ageLabel: "25–34",
      countryLabel: "India",
      hoursLabel: "12 hrs",
      profileHref: null
    },
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
    author: {
      id: "mock-maya",
      name: "Maya",
      username: "maya_moves",
      handle: "@maya_moves",
      avatar: LIVE_IMAGES.sidebar2,
      ageLabel: "25–34",
      countryLabel: "United States",
      hoursLabel: "28 hrs",
      profileHref: null
    },
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
    author: {
      id: "mock-alex",
      name: "Alex",
      username: "alex_runs",
      handle: "@alex_runs",
      avatar: LIVE_IMAGES.participant1,
      ageLabel: "18–24",
      countryLabel: "Canada",
      hoursLabel: "9 hrs",
      profileHref: null
    },
    quote: "There is no finish line — only the community that keeps you going.",
    likes: 96,
    comments: 18
  },
  {
    id: "lift",
    kind: "image",
    author: {
      id: "mock-taylor",
      name: "Taylor",
      username: "taylor_fits",
      handle: "@taylor_fits",
      avatar: LIVE_IMAGES.participant3,
      ageLabel: "35–44",
      countryLabel: "United Kingdom",
      hoursLabel: "16 hrs",
      profileHref: null
    },
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
    author: {
      id: "mock-riley",
      name: "Riley",
      username: "riley_eats",
      handle: "@riley_eats",
      avatar: LIVE_IMAGES.sidebar1,
      ageLabel: "25–34",
      countryLabel: "Australia",
      hoursLabel: "7 hrs",
      profileHref: null
    },
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
    author: {
      id: "mock-sam",
      name: "Sam",
      username: "sam_sweats",
      handle: "@sam_sweats",
      avatar: LIVE_IMAGES.participant5,
      ageLabel: "18–24",
      countryLabel: "Singapore",
      hoursLabel: "11 hrs",
      profileHref: null
    },
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
    author: {
      id: "mock-chris",
      name: "Chris",
      username: "chris_flow",
      handle: "@chris_flow",
      avatar: LIVE_IMAGES.participant7,
      ageLabel: "25–34",
      countryLabel: "India",
      hoursLabel: "14 hrs",
      profileHref: null
    },
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
    author: {
      id: "mock-morgan",
      name: "Morgan",
      username: "morgan_minds",
      handle: "@morgan_minds",
      avatar: LIVE_IMAGES.participant8,
      ageLabel: "35–44",
      countryLabel: "United Arab Emirates",
      hoursLabel: "6 hrs",
      profileHref: null
    },
    quote: "Show up for yourself — the feed will celebrate with you.",
    likes: 141,
    comments: 22
  }
];
