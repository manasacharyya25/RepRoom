import { LIVE_IMAGES } from "@/lib/live-images";

export type InboxMessage = {
  id: string;
  from: "them" | "you";
  text: string;
  time: string;
};

export type InboxThread = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  preview: string;
  time: string;
  unread?: boolean;
  messages: InboxMessage[];
};

export const INBOX_THREADS: InboxThread[] = [
  {
    id: "t1",
    name: "Maya",
    handle: "@maya_moves",
    avatar: LIVE_IMAGES.sidebar2,
    preview: "You free for the 7am yoga room tomorrow?",
    time: "2m",
    unread: true,
    messages: [
      {
        id: "t1-1",
        from: "them",
        text: "That squat PR looked clean 🔥",
        time: "Yesterday"
      },
      {
        id: "t1-2",
        from: "you",
        text: "Thanks! Still sore though.",
        time: "Yesterday"
      },
      {
        id: "t1-3",
        from: "them",
        text: "You free for the 7am yoga room tomorrow?",
        time: "2m"
      }
    ]
  },
  {
    id: "t2",
    name: "Jordan",
    handle: "@jordan_lifts",
    avatar: LIVE_IMAGES.participant6,
    preview: "Leg day rematch this weekend?",
    time: "18m",
    unread: true,
    messages: [
      {
        id: "t2-1",
        from: "them",
        text: "Still thinking about that deadlift session.",
        time: "1h"
      },
      {
        id: "t2-2",
        from: "you",
        text: "Same. We should go again.",
        time: "45m"
      },
      {
        id: "t2-3",
        from: "them",
        text: "Leg day rematch this weekend?",
        time: "18m"
      }
    ]
  },
  {
    id: "t3",
    name: "Alex",
    handle: "@alex_runs",
    avatar: LIVE_IMAGES.participant1,
    preview: "Sent you the cardio playlist 🎧",
    time: "1h",
    messages: [
      {
        id: "t3-1",
        from: "them",
        text: "That midnight cardio room was wild.",
        time: "3h"
      },
      {
        id: "t3-2",
        from: "you",
        text: "I barely survived the last 10 minutes.",
        time: "2h"
      },
      {
        id: "t3-3",
        from: "them",
        text: "Sent you the cardio playlist 🎧",
        time: "1h"
      }
    ]
  },
  {
    id: "t4",
    name: "Riley",
    handle: "@riley_moves",
    avatar: LIVE_IMAGES.sidebar1,
    preview: "Nice check-in on your streak!",
    time: "3h",
    messages: [
      {
        id: "t4-1",
        from: "them",
        text: "Saw your 21-day streak — respect.",
        time: "5h"
      },
      {
        id: "t4-2",
        from: "you",
        text: "Appreciate it. Trying not to break it.",
        time: "4h"
      },
      {
        id: "t4-3",
        from: "them",
        text: "Nice check-in on your streak!",
        time: "3h"
      }
    ]
  },
  {
    id: "t5",
    name: "Sam",
    handle: "@sam_strong",
    avatar: LIVE_IMAGES.participant3,
    preview: "Private room link is in the notes.",
    time: "Yesterday",
    messages: [
      {
        id: "t5-1",
        from: "you",
        text: "Can you share the private room again?",
        time: "Yesterday"
      },
      {
        id: "t5-2",
        from: "them",
        text: "Private room link is in the notes.",
        time: "Yesterday"
      }
    ]
  },
  {
    id: "t6",
    name: "Casey",
    handle: "@casey_flow",
    avatar: LIVE_IMAGES.participant5,
    preview: "Meditation room was perfect today.",
    time: "2d",
    messages: [
      {
        id: "t6-1",
        from: "them",
        text: "Meditation room was perfect today.",
        time: "2d"
      },
      {
        id: "t6-2",
        from: "you",
        text: "Same. I needed that reset.",
        time: "2d"
      }
    ]
  }
];
