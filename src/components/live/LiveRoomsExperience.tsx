"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "@/app/live-rooms.css";
import { useEntitlements } from "@/components/auth/EntitlementsProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { PremiumPlanModal } from "@/components/billing/PremiumPlanModal";
import { ChunkPreviewPlayer } from "@/components/live/ChunkPreviewPlayer";
import { FeedAuthorHoverCard } from "@/components/feed/FeedAuthorHoverCard";
import type { FeedAuthorPreview } from "@/lib/feed-posts";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import "@/app/billing.css";
import {
  canAccessRoom,
  formatRemainingTime,
  GUEST_ROOM_ID,
  type Tier,
  type UpgradeReason
} from "@/lib/entitlements";
import { exitFullscreen, toggleFullscreen } from "@/lib/fullscreen";
import {
  fetchLobbySenderProfile,
  listLobbyMessages,
  mapDbLobbyMessageToView
} from "@/lib/lobby-chat-api";
import {
  exerciseNamesFromPlan,
  LobbyChatComposer
} from "@/components/live/LobbyChatComposer";
import { LobbyWorkoutLogCard } from "@/components/live/LobbyWorkoutLogCard";
import { WorkoutAcceptPrompt } from "@/components/live/WorkoutAcceptPrompt";
import { LIVE_IMAGES } from "@/lib/live-images";
import { normalizeWorkoutPlan, type WorkoutPlan } from "@/lib/workout-plan";
import {
  buildWeekDaySlots,
  startOfWeekMonday
} from "@/lib/weekly-plan-calendar";
import {
  getRoomLiveSets,
  isRoomComingSoon,
  WORKOUT_ROOMS,
  type RoomLiveSet,
  type WorkoutRoom
} from "@/lib/rooms";
import {
  captureLiveCamera,
  stopMediaStream
} from "@/lib/streaming/capture";
import {
  startChunkRecorder,
  type ChunkRecorder
} from "@/lib/streaming/chunk-recorder";
import {
  LIVE_DISCOVERY_PAGE_SIZE,
  type LiveSessionView
} from "@/lib/streaming/live-sessions";
import { createClient } from "@/lib/supabase/client";
import type {
  DbLobbyMessage,
  LobbyMessageView
} from "@/lib/types/lobby-chat";

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

const MOBILE_VIEWPORT_QUERY = "(max-width: 960px)";
/** Pinned (2) + bottom (2); rail is hidden on mobile. */
const MOBILE_DISCOVERY_SLOT_COUNT = 4;

/** CSS grid-area names for discovery slots (flat stage — keeps players under one parent). */
function discoveryGridArea(slot: number): string {
  if (slot === 0) return "pin0";
  if (slot === 1) return "pin1";
  if (slot >= 2 && slot <= 5) return `bot${slot - 2}`;
  return `rail${slot - 6}`;
}

/** Fisher–Yates shuffle (mutates and returns the same array). Used to randomize
 *  session order before serial tile fill so the first tile changes each refresh. */
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

function discoveryTileClassName(slot: number, promotable: boolean): string {
  const region =
    slot < 2
      ? "live-rooms-immersive-pinned-tile"
      : slot < 6
        ? "live-rooms-immersive-bottom-tile"
        : "live-rooms-immersive-rail-tile";
  return `live-rooms-preview-tile ${region}${
    promotable ? " is-promotable" : ""
  }`;
}

function placeholderForDiscoverySlot(
  layout: RoomLiveSet,
  slot: number
): { name: string; image: string } {
  if (slot === 0) return layout.main[0];
  if (slot === 1) return layout.main[1];
  if (slot >= 2 && slot <= 5) return layout.bottom[slot - 2];
  return layout.rail[Math.min(4, Math.max(0, slot - 6))];
}

type InactiveTilePromoAction = "go_live" | "upgrade";

type InactiveTilePromo = {
  id: string;
  eyebrow?: string;
  title: string;
  lines: string[];
  cta?: { label: string; action: InactiveTilePromoAction };
};

const INACTIVE_TILE_PROMOS: InactiveTilePromo[] = [
  {
    id: "spot",
    title: "This spot could be yours.",
    lines: [],
    cta: { label: "Start broadcasting", action: "go_live" }
  },
  {
    id: "challenge",
    eyebrow: "Weekly Challenge",
    title: "This Week",
    lines: ["Complete", "5 Workouts", "Join 2,341 others"]
  },
  {
    id: "stats",
    eyebrow: "Community Stats",
    title: "Today",
    lines: ["842 workouts", "128 hours trained"]
  },
  {
    id: "share",
    eyebrow: "Share RhoQ",
    title: "Workout Together",
    lines: ["Invite a friend", "and stay accountable."]
  },
  {
    id: "upgrade",
    eyebrow: "Upgrade RhoQ",
    title: "RhoQ Pro",
    lines: [
      "Unlimited broadcasts",
      "Priority visibility",
      "Exclusive badges"
    ],
    cta: { label: "Upgrade →", action: "upgrade" }
  },
  {
    id: "sponsored",
    eyebrow: "Sponsored",
    title: "Protein Brand",
    lines: ["20% OFF"]
  },
  {
    id: "feature",
    eyebrow: "Feature Creator",
    title: "New Feature",
    lines: ["Pin your favourite", "workout partners."]
  }
];

function promoForSlot(slotIndex: number): InactiveTilePromo {
  return INACTIVE_TILE_PROMOS[
    ((slotIndex % INACTIVE_TILE_PROMOS.length) + INACTIVE_TILE_PROMOS.length) %
      INACTIVE_TILE_PROMOS.length
  ];
}

function InactiveTilePromoOverlay({
  promo,
  featured = false,
  onGoLive,
  onUpgrade
}: {
  promo: InactiveTilePromo;
  featured?: boolean;
  onGoLive?: () => void;
  onUpgrade?: () => void;
}) {
  return (
    <div
      className={`live-rooms-inactive-promo${
        featured ? " live-rooms-inactive-promo--featured" : ""
      }`}
    >
      <div className="live-rooms-inactive-promo-blur" aria-hidden />
      <div className="live-rooms-inactive-promo-copy">
        {promo.eyebrow ? (
          <p className="live-rooms-inactive-promo-eyebrow">{promo.eyebrow}</p>
        ) : null}
        <p className="live-rooms-inactive-promo-title">{promo.title}</p>
        {promo.lines.map((line) => (
          <p className="live-rooms-inactive-promo-line" key={line}>
            {line}
          </p>
        ))}
        {promo.cta ? (
          <button
            type="button"
            className="live-rooms-inactive-promo-cta"
            onClick={(event) => {
              event.stopPropagation();
              if (promo.cta?.action === "go_live") onGoLive?.();
              if (promo.cta?.action === "upgrade") onUpgrade?.();
            }}
          >
            {promo.cta.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

function TileUserLabel({
  label,
  labelPosition = "left",
  author,
  variant = "tile"
}: {
  label: string;
  labelPosition?: "left" | "center";
  author?: FeedAuthorPreview | null;
  variant?: "tile" | "featured";
}) {
  const labelClass =
    variant === "featured"
      ? "live-rooms-featured-label"
      : `live-rooms-tile-label${
          labelPosition === "center" ? " live-rooms-tile-label--center" : ""
        }`;

  if (!author) {
    return <span className={labelClass}>{label}</span>;
  }

  return (
    <FeedAuthorHoverCard
      author={author}
      cardPlacement="above"
      className={`live-rooms-tile-author-hover${
        labelPosition === "center"
          ? " live-rooms-tile-author-hover--center"
          : ""
      }${variant === "featured" ? " live-rooms-tile-author-hover--featured" : ""}`}
    >
      <span className={`${labelClass} is-interactive`}>{label}</span>
    </FeedAuthorHoverCard>
  );
}

function EmptyDiscoveryTile({
  className,
  image,
  priority = false,
  sizes,
  slotIndex = 0,
  featured = false,
  style,
  onGoLive,
  onUpgrade
}: {
  className?: string;
  image: string;
  priority?: boolean;
  sizes: string;
  slotIndex?: number;
  featured?: boolean;
  style?: CSSProperties;
  onGoLive?: () => void;
  onUpgrade?: () => void;
}) {
  const promo = promoForSlot(slotIndex);

  return (
    <div
      aria-label={promo.title}
      className={`live-rooms-preview-tile ${className ?? ""}`}
      role="group"
      style={style}
    >
      <Image
        alt=""
        className={
          featured ? "live-rooms-featured-image" : "live-rooms-tile-image"
        }
        fill
        priority={priority}
        sizes={sizes}
        src={image}
      />
      <InactiveTilePromoOverlay
        featured={featured}
        promo={promo}
        onGoLive={onGoLive}
        onUpgrade={onUpgrade}
      />
    </div>
  );
}

export function ImmersiveRoom({
  room,
  onLeave,
  tier = "free",
  remainingSeconds = null,
  quotaSeconds = 0,
  onNeedSignInToGoLive,
  onBroadcastRemaining,
  onBroadcastLimitReached,
  onRequestUpgrade,
  staticPreviewOnly = false,
  blurred = false
}: {
  room: WorkoutRoom;
  onLeave: () => void | Promise<void>;
  tier?: Tier;
  remainingSeconds?: number | null;
  /** Guest view quota used for the depleting progress bar. */
  quotaSeconds?: number;
  onNeedSignInToGoLive?: () => void;
  /** Free broadcast remaining after a flush or live tick. */
  onBroadcastRemaining?: (remainingSeconds: number | null) => void;
  onBroadcastLimitReached?: () => void;
  onRequestUpgrade?: () => void;
  /** Force static images only — used when view limit hits. */
  staticPreviewOnly?: boolean;
  /** Blur the room UI under a limit modal. */
  blurred?: boolean;
}) {
  const isMobileViewport = useIsMobileViewport();
  const { user: authUser } = useAuth();
  const viewerUserIdRef = useRef<string | null>(authUser?.id ?? null);
  viewerUserIdRef.current = authUser?.id ?? null;
  const discoverySlotCount = isMobileViewport
    ? MOBILE_DISCOVERY_SLOT_COUNT
    : LIVE_DISCOVERY_PAGE_SIZE;
  const discoverySlotCountRef = useRef(discoverySlotCount);
  discoverySlotCountRef.current = discoverySlotCount;
  const liveSets = useMemo(() => getRoomLiveSets(room, 1), [room]);
  const [roomPage, setRoomPage] = useState(0);
  const [layout, setLayout] = useState<RoomLiveSet>(() =>
    cloneLiveSet(liveSets[0] ?? getRoomLiveSets(room, 1)[0])
  );
  const [selfMainSlot, setSelfMainSlot] = useState<0 | 1>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const isLiveRef = useRef(false);
  isLiveRef.current = isLive;
  /** Slot 0 reserved for local camera; discovery shifted right while live. */
  const selfSlotReservedRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [tabHidden, setTabHidden] = useState(false);
  const [viewTimerPercent, setViewTimerPercent] = useState<number | null>(null);
  const [messages, setMessages] = useState<LobbyMessageView[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [workoutAcceptOpen, setWorkoutAcceptOpen] = useState(false);
  const [acceptedPlanDayIndex, setAcceptedPlanDayIndex] = useState<
    number | null
  >(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkRecorderRef = useRef<ChunkRecorder | null>(null);
  /** R2 live_sessions row id. */
  const liveR2SessionIdRef = useRef<string | null>(null);
  const liveEpochRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const profileCacheRef = useRef(
    new Map<string, Awaited<ReturnType<typeof fetchLobbySenderProfile>>>()
  );
  const supabase = useMemo(() => createClient(), []);
  const [liveSlots, setLiveSlots] = useState<(LiveSessionView | null)[]>(() =>
    Array.from({ length: LIVE_DISCOVERY_PAGE_SIZE }, () => null)
  );
  const [archiveSlots, setArchiveSlots] = useState<(LiveSessionView | null)[]>(
    () => Array.from({ length: LIVE_DISCOVERY_PAGE_SIZE }, () => null)
  );
  const [discoveryReady, setDiscoveryReady] = useState(
    () => staticPreviewOnly
  );
  const liveSlotsRef = useRef(liveSlots);
  liveSlotsRef.current = liveSlots;
  const archiveSlotsRef = useRef(archiveSlots);
  archiveSlotsRef.current = archiveSlots;
  /** Archive sessions that finished a full replay this room visit — prefer others first. */
  const playedArchiveSessionIdsRef = useRef(new Set<string>());
  const viewEndsAtRef = useRef<number | null>(null);
  const broadcastStartedAtRef = useRef<number | null>(null);
  const broadcastBudgetRef = useRef<number | null>(null);
  const broadcastFlushedRef = useRef(0);
  const broadcastLimitNotifiedRef = useRef(false);
  const activeSet = liveSets[0];
  const ROOM_PAGE_COUNT = 2;
  const onDiscoveryPage = roomPage === 0;

  const logExerciseOptions = useMemo(() => {
    const index =
      acceptedPlanDayIndex ??
      (workoutPlan
        ? buildWeekDaySlots(
            workoutPlan,
            startOfWeekMonday(new Date())
          ).find((slot) => slot.isToday)?.sessionIndex ?? null
        : null);
    return exerciseNamesFromPlan(workoutPlan, index);
  }, [acceptedPlanDayIndex, workoutPlan]);

  const logPlanDayIndex = useMemo(() => {
    if (acceptedPlanDayIndex != null) return acceptedPlanDayIndex;
    if (!workoutPlan) return null;
    return (
      buildWeekDaySlots(workoutPlan, startOfWeekMonday(new Date())).find(
        (slot) => slot.isToday
      )?.sessionIndex ?? null
    );
  }, [acceptedPlanDayIndex, workoutPlan]);

  useEffect(() => {
    playedArchiveSessionIdsRef.current = new Set();
  }, [room.id]);

  useEffect(() => {
    if (!authUser?.id) {
      setWorkoutPlan(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("workout_plan")
          .eq("id", authUser.id)
          .maybeSingle();
        if (cancelled) return;
        const raw = data?.workout_plan ?? null;
        setWorkoutPlan(
          raw ? normalizeWorkoutPlan(raw) ?? (raw as WorkoutPlan) : null
        );
      } catch {
        if (!cancelled) setWorkoutPlan(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, supabase]);

  const showQuotaTimer =
    (tier === "guest" || tier === "free") &&
    quotaSeconds > 0 &&
    remainingSeconds !== null &&
    remainingSeconds >= 0;

  useEffect(() => {
    if (!showQuotaTimer) {
      viewEndsAtRef.current = null;
      setViewTimerPercent(null);
      return;
    }

    const depleting = tier === "guest" || (tier === "free" && isLive);

    if (!depleting) {
      viewEndsAtRef.current = null;
      setViewTimerPercent(
        Math.max(
          0,
          Math.min(100, (remainingSeconds / quotaSeconds) * 100)
        )
      );
      return;
    }

    viewEndsAtRef.current = Date.now() + remainingSeconds * 1000;

    const tick = () => {
      const endsAt = viewEndsAtRef.current;
      if (endsAt === null) return;
      const leftMs = Math.max(0, endsAt - Date.now());
      setViewTimerPercent(
        Math.max(0, Math.min(100, (leftMs / (quotaSeconds * 1000)) * 100))
      );
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [showQuotaTimer, remainingSeconds, quotaSeconds, tier, isLive]);

  const emptyDiscoverySlots = () =>
    Array.from(
      { length: LIVE_DISCOVERY_PAGE_SIZE },
      () => null as LiveSessionView | null
    );

  const shiftDiscoveryRightForSelf = useCallback(() => {
    if (selfSlotReservedRef.current) return;
    selfSlotReservedRef.current = true;
    setSelfMainSlot(0);
    setLiveSlots((prev) => [
      null,
      ...prev.slice(0, LIVE_DISCOVERY_PAGE_SIZE - 1)
    ]);
    setArchiveSlots((prev) => [
      null,
      ...prev.slice(0, LIVE_DISCOVERY_PAGE_SIZE - 1)
    ]);
  }, []);

  const releaseDiscoverySelfSlot = useCallback(() => {
    if (!selfSlotReservedRef.current) return;
    selfSlotReservedRef.current = false;
    setLiveSlots((prev) => [...prev.slice(1), null]);
    setArchiveSlots((prev) => [...prev.slice(1), null]);
  }, []);

  useEffect(() => {
    setLayout(cloneLiveSet(activeSet));
    setSelfMainSlot(0);
  }, [activeSet, liveSets]);

  useEffect(() => {
    const onVisibility = () => {
      setTabHidden(document.hidden);
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const pauseIncoming = tabHidden || !onDiscoveryPage;

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

  const showPreviousPage = () => {
    setRoomPage((page) => (page - 1 + ROOM_PAGE_COUNT) % ROOM_PAGE_COUNT);
  };

  const showNextPage = () => {
    setRoomPage((page) => (page + 1) % ROOM_PAGE_COUNT);
  };

  const stopCamera = useCallback(() => {
    liveEpochRef.current += 1;

    const liveR2SessionId = liveR2SessionIdRef.current;
    liveR2SessionIdRef.current = null;

    const broadcastStartedAt = broadcastStartedAtRef.current;
    const broadcastBudget = broadcastBudgetRef.current;
    const alreadyFlushed = broadcastFlushedRef.current;
    broadcastStartedAtRef.current = null;
    broadcastBudgetRef.current = null;
    broadcastFlushedRef.current = 0;

    chunkRecorderRef.current?.stop();
    chunkRecorderRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLive(false);
    setIsGoingLive(false);
    releaseDiscoverySelfSlot();

    if (liveR2SessionId) {
      void fetch("/api/live/sessions/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: liveR2SessionId })
      }).catch(() => {
        /* End session is best-effort */
      });
    }

    if ((tier === "free" || tier === "premium") && broadcastStartedAt !== null) {
      const elapsed = Math.max(
        0,
        Math.round((Date.now() - broadcastStartedAt) / 1000)
      );
      const capped =
        broadcastBudget === null
          ? elapsed
          : Math.min(elapsed, Math.max(0, broadcastBudget));
      const seconds = Math.max(0, capped - alreadyFlushed);
      if (seconds > 0) {
        void (async () => {
          try {
            const fingerprint = await getDeviceFingerprint();
            const response = await fetch("/api/room-access/broadcast", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fingerprint, seconds }),
              keepalive: true
            });
            if (!response.ok) return;
            const data = (await response.json()) as {
              remainingSeconds?: number | null;
              exhausted?: boolean;
              serverStop?: boolean;
            };
            onBroadcastRemaining?.(
              data.remainingSeconds === undefined
                ? null
                : data.remainingSeconds
            );
            if (data.exhausted && !broadcastLimitNotifiedRef.current) {
              broadcastLimitNotifiedRef.current = true;
              onBroadcastLimitReached?.();
            }
          } catch {
            /* best-effort */
          }
        })();
      }
    }
  }, [
    onBroadcastLimitReached,
    onBroadcastRemaining,
    releaseDiscoverySelfSlot,
    tier
  ]);

  const flushBroadcastProgress = useCallback(async () => {
    if (tier !== "free" && tier !== "premium") return;
    const started = broadcastStartedAtRef.current;
    const budget = broadcastBudgetRef.current;
    if (started === null) return;

    const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
    const capped = budget === null ? elapsed : Math.min(elapsed, Math.max(0, budget));
    const seconds = Math.max(0, capped - broadcastFlushedRef.current);
    if (seconds <= 0) return;

    broadcastFlushedRef.current += seconds;

    try {
      const fingerprint = await getDeviceFingerprint();
      const response = await fetch("/api/room-access/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint, seconds })
      });
      if (!response.ok) {
        broadcastFlushedRef.current = Math.max(
          0,
          broadcastFlushedRef.current - seconds
        );
        return;
      }
      const data = (await response.json()) as {
        remainingSeconds?: number | null;
        exhausted?: boolean;
        serverStop?: boolean;
      };
      onBroadcastRemaining?.(
        data.remainingSeconds === undefined ? null : data.remainingSeconds
      );
      if (data.exhausted) {
        stopCamera();
        if (!broadcastLimitNotifiedRef.current) {
          broadcastLimitNotifiedRef.current = true;
          onBroadcastLimitReached?.();
        }
      } else if (data.serverStop) {
        // Premium silent daily cap — stop broadcast without upgrade UX.
        stopCamera();
      }
    } catch {
      broadcastFlushedRef.current = Math.max(
        0,
        broadcastFlushedRef.current - seconds
      );
    }
  }, [onBroadcastLimitReached, onBroadcastRemaining, stopCamera, tier]);

  const startCamera = useCallback(async () => {
    setIsGoingLive(true);
    setCameraError(null);

    const epoch = liveEpochRef.current + 1;
    liveEpochRef.current = epoch;

    try {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setIsGoingLive(false);
        onNeedSignInToGoLive?.();
        return;
      }

      if (
        tier === "free" &&
        remainingSeconds !== null &&
        remainingSeconds <= 0
      ) {
        setIsGoingLive(false);
        onBroadcastLimitReached?.();
        return;
      }

      const stream = await captureLiveCamera();
      if (liveEpochRef.current !== epoch) {
        stopMediaStream(stream);
        return;
      }

      streamRef.current = stream;
      if (tier === "free" || tier === "premium") {
        broadcastLimitNotifiedRef.current = false;
        broadcastFlushedRef.current = 0;
        broadcastBudgetRef.current =
          tier === "premium" ? null : remainingSeconds;
        broadcastStartedAtRef.current = Date.now();
      }
      setSelfMainSlot(0);
      shiftDiscoveryRightForSelf();
      setIsLive(true);
      setIsGoingLive(false);
      attachStreamToVideo(videoRef.current);

      void (async () => {
        if (liveEpochRef.current !== epoch || !streamRef.current) return;

        try {
          const liveResponse = await fetch("/api/live/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: room.id })
          });
          if (!liveResponse.ok || liveEpochRef.current !== epoch) {
            if (liveEpochRef.current === epoch) {
              stopCamera();
              if (liveResponse.status === 403) {
                const err = (await liveResponse.json().catch(() => null)) as {
                  reason?: string;
                } | null;
                if (err?.reason === "free_time") {
                  onBroadcastRemaining?.(0);
                  onBroadcastLimitReached?.();
                  return;
                }
                if (err?.reason === "premium_daily_cap") {
                  return;
                }
              }
              setCameraError("Could not start live session.");
            }
            return;
          }
          const liveData = (await liveResponse.json()) as {
            session: LiveSessionView;
          };
          liveR2SessionIdRef.current = liveData.session.sessionId;

          chunkRecorderRef.current?.stop();
          chunkRecorderRef.current = startChunkRecorder({
            stream: streamRef.current,
            roomId: room.id,
            sessionId: liveData.session.sessionId,
            onError: (message) => {
              console.warn("[preview-chunks]", message);
            },
            onUploaded: (info) => {
              console.info("[preview-chunks] uploaded", info.key);
            }
          });
        } catch {
          if (liveEpochRef.current === epoch) {
            stopCamera();
            setCameraError("Could not start live session.");
          }
        }
      })();
    } catch (error) {
      if (liveEpochRef.current === epoch) {
        stopCamera();
        setCameraError(
          error instanceof Error
            ? error.message
            : "Could not access your camera."
        );
      }
    } finally {
      if (liveEpochRef.current === epoch) {
        setIsGoingLive(false);
      }
    }
  }, [
    attachStreamToVideo,
    onBroadcastLimitReached,
    onBroadcastRemaining,
    onNeedSignInToGoLive,
    remainingSeconds,
    room.id,
    shiftDiscoveryRightForSelf,
    stopCamera,
    tier
  ]);

  useEffect(() => {
    if (!isLive || (tier !== "free" && tier !== "premium")) return;
    if (broadcastStartedAtRef.current === null) return;

    const tick = () => {
      const started = broadcastStartedAtRef.current;
      const budget = broadcastBudgetRef.current;
      if (started === null) return;
      // Premium: no local countdown (UX unlimited); server flush enforces silent cap.
      if (budget === null) return;
      const elapsed = (Date.now() - started) / 1000;
      const left = Math.max(0, budget - elapsed);
      onBroadcastRemaining?.(Math.ceil(left));
      if (left <= 0) {
        stopCamera();
        if (!broadcastLimitNotifiedRef.current) {
          broadcastLimitNotifiedRef.current = true;
          onBroadcastLimitReached?.();
        }
      }
    };

    tick();
    const tickId = window.setInterval(tick, 1000);
    const flushId = window.setInterval(() => {
      void flushBroadcastProgress();
    }, 60_000);

    return () => {
      window.clearInterval(tickId);
      window.clearInterval(flushId);
    };
  }, [
    flushBroadcastProgress,
    isLive,
    onBroadcastLimitReached,
    onBroadcastRemaining,
    stopCamera,
    tier
  ]);

  const discoveryEnabled = !staticPreviewOnly;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setChatLoading(true);
      setChatError(null);
      try {
        const rows = await listLobbyMessages(supabase);
        if (cancelled) return;
        setMessages(rows.filter((row) => row.messageType === "workout_log"));
        for (const row of rows) {
          if (row.messageType !== "workout_log") continue;
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
      .channel(`lobby-chat-room-${room.id}`)
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
            if (view.messageType !== "workout_log") return;
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
  }, [room.id, supabase]);

  useEffect(() => {
    if (roomPage !== 1 || chatLoading) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, roomPage, chatLoading]);

  const fetchEndedArchives = useCallback(
    async (options: {
      limit: number;
      excludeSessionIds: string[];
      excludeUserIds: string[];
      /** When true, also skip sessions already fully replayed this visit. */
      excludePlayed?: boolean;
    }) => {
      if (options.limit <= 0) return [] as LiveSessionView[];
      const excludeSessionIds = [...options.excludeSessionIds];
      if (options.excludePlayed) {
        for (const id of playedArchiveSessionIdsRef.current) {
          excludeSessionIds.push(id);
        }
      }
      const excludeUserIds = [...options.excludeUserIds];
      const viewerId = viewerUserIdRef.current;
      if (viewerId) excludeUserIds.push(viewerId);

      const params = new URLSearchParams({
        roomId: room.id,
        limit: String(Math.max(options.limit * 3, options.limit))
      });
      if (excludeSessionIds.length > 0) {
        params.set("exclude", [...new Set(excludeSessionIds)].join(","));
      }
      if (excludeUserIds.length > 0) {
        params.set("excludeUsers", [...new Set(excludeUserIds)].join(","));
      }
      const response = await fetch(
        `/api/live/sessions/archives?${params.toString()}`
      );
      if (!response.ok) return [];
      const data = (await response.json()) as {
        sessions?: LiveSessionView[];
      };
      return data.sessions ?? [];
    },
    [room.id]
  );

  const fillArchiveSlots = useCallback(
    async (
      live: (LiveSessionView | null)[],
      previousArchives: (LiveSessionView | null)[] = emptyDiscoverySlots(),
      options?: { allowPlayed?: boolean }
    ) => {
      const allowPlayed = options?.allowPlayed ?? false;
      const nextArchives = emptyDiscoverySlots();
      const usedSessionIds = new Set<string>();
      const usedUserIds = new Set<string>();
      const reserveSelf = selfSlotReservedRef.current;
      const fillStart = reserveSelf ? 1 : 0;
      const slotCount = discoverySlotCountRef.current;
      const viewerId = viewerUserIdRef.current;
      const played = playedArchiveSessionIdsRef.current;

      if (viewerId) usedUserIds.add(viewerId);

      for (const session of live) {
        if (!session) continue;
        usedSessionIds.add(session.sessionId);
        usedUserIds.add(session.userId);
      }
      if (liveR2SessionIdRef.current) {
        usedSessionIds.add(liveR2SessionIdRef.current);
      }

      // Keep existing archive assignments when still valid (one user per tile).
      for (let index = fillStart; index < slotCount; index++) {
        if (live[index]) continue;
        const existing = previousArchives[index];
        if (!existing) continue;
        if (viewerId && existing.userId === viewerId) continue;
        if (usedSessionIds.has(existing.sessionId)) continue;
        if (usedUserIds.has(existing.userId)) continue;
        if (!allowPlayed && played.has(existing.sessionId)) continue;
        nextArchives[index] = existing;
        usedSessionIds.add(existing.sessionId);
        usedUserIds.add(existing.userId);
      }

      const emptyIndexes: number[] = [];
      for (let index = fillStart; index < slotCount; index++) {
        if (!live[index] && !nextArchives[index]) {
          emptyIndexes.push(index);
        }
      }

      if (emptyIndexes.length === 0) {
        return nextArchives;
      }

      const fetched = shuffleInPlace(
        await fetchEndedArchives({
          limit: emptyIndexes.length,
          excludeSessionIds: [...usedSessionIds],
          excludeUserIds: [...usedUserIds],
          excludePlayed: !allowPlayed
        })
      );

      let fetchIndex = 0;
      for (const slotIndex of emptyIndexes) {
        while (fetchIndex < fetched.length) {
          const candidate = fetched[fetchIndex];
          fetchIndex += 1;
          if (!candidate) continue;
          if (viewerId && candidate.userId === viewerId) continue;
          if (usedSessionIds.has(candidate.sessionId)) continue;
          if (usedUserIds.has(candidate.userId)) continue;
          if (!allowPlayed && played.has(candidate.sessionId)) continue;
          nextArchives[slotIndex] = candidate;
          usedSessionIds.add(candidate.sessionId);
          usedUserIds.add(candidate.userId);
          break;
        }
      }

      // If unplayed pool is exhausted, allow replayed archives once.
      if (!allowPlayed) {
        const stillEmpty = emptyIndexes.some(
          (index) => !live[index] && !nextArchives[index]
        );
        if (stillEmpty) {
          return fillArchiveSlots(live, nextArchives, { allowPlayed: true });
        }
      }

      return nextArchives;
    },
    [fetchEndedArchives]
  );

  const replaceArchiveSlot = useCallback(
    async (slotIndex: number, finishedSessionId: string) => {
      if (!discoveryEnabled) return;
      if (selfSlotReservedRef.current && slotIndex === 0) return;

      playedArchiveSessionIdsRef.current.add(finishedSessionId);

      const current = archiveSlotsRef.current[slotIndex];
      if (!current || current.sessionId !== finishedSessionId) return;

      const cleared = [...archiveSlotsRef.current];
      cleared[slotIndex] = null;
      archiveSlotsRef.current = cleared;
      setArchiveSlots(cleared);

      const nextArchives = await fillArchiveSlots(
        liveSlotsRef.current,
        cleared,
        { allowPlayed: false }
      );
      archiveSlotsRef.current = nextArchives;
      setArchiveSlots(nextArchives);
    },
    [discoveryEnabled, fillArchiveSlots]
  );

  const replaceLiveSlot = useCallback(
    async (slotIndex: number, deadSessionId: string) => {
      if (!discoveryEnabled) return;

      const exclude = new Set(
        liveSlotsRef.current
          .filter((session): session is LiveSessionView => Boolean(session))
          .map((session) => session.sessionId)
      );
      exclude.add(deadSessionId);
      if (liveR2SessionIdRef.current) {
        exclude.add(liveR2SessionIdRef.current);
      }

      let replacement: LiveSessionView | null = null;
      try {
        const response = await fetch(
          `/api/live/sessions/replace?roomId=${encodeURIComponent(room.id)}&exclude=${encodeURIComponent(
            [...exclude].join(",")
          )}`
        );
        if (response.ok) {
          const data = (await response.json()) as {
            session?: LiveSessionView | null;
          };
          replacement = data.session ?? null;
          const viewerId = viewerUserIdRef.current;
          // Don't place a live session for a user already on another tile (or self).
          if (replacement) {
            const takenUsers = new Set(
              liveSlotsRef.current
                .filter(Boolean)
                .map((session) => session!.userId)
            );
            for (const archive of archiveSlotsRef.current) {
              if (archive) takenUsers.add(archive.userId);
            }
            if (viewerId) takenUsers.add(viewerId);
            // Allow replacement onto this slot: remove the dead session's user from "taken"
            const dead = liveSlotsRef.current[slotIndex];
            if (dead) takenUsers.delete(dead.userId);
            if (takenUsers.has(replacement.userId)) {
              replacement = null;
            }
          }
        }
      } catch {
        replacement = null;
      }

      const nextLive = [...liveSlotsRef.current];
      if (selfSlotReservedRef.current && slotIndex === 0) return;
      if (nextLive[slotIndex]?.sessionId !== deadSessionId) return;
      nextLive[slotIndex] = replacement;
      setLiveSlots(nextLive);
      liveSlotsRef.current = nextLive;

      if (!replacement) {
        const nextArchives = await fillArchiveSlots(
          nextLive,
          archiveSlotsRef.current
        );
        archiveSlotsRef.current = nextArchives;
        setArchiveSlots(nextArchives);
      } else {
        setArchiveSlots((prev) => {
          const next = [...prev];
          next[slotIndex] = null;
          archiveSlotsRef.current = next;
          return next;
        });
      }
    },
    [discoveryEnabled, fillArchiveSlots, room.id]
  );

  useEffect(() => {
    if (!discoveryEnabled) {
      setLiveSlots(emptyDiscoverySlots());
      setArchiveSlots(emptyDiscoverySlots());
      setDiscoveryReady(true);
      return;
    }

    let cancelled = false;
    setDiscoveryReady(false);

    const loadDiscovery = async () => {
      try {
        const slotCount = discoverySlotCountRef.current;
        const response = await fetch(
          `/api/live/sessions?roomId=${encodeURIComponent(room.id)}&limit=${slotCount}`
        );
        if (cancelled) return;
        if (response.ok) {
          const data = (await response.json()) as {
            sessions?: LiveSessionView[];
          };
          const selfId = liveR2SessionIdRef.current;
          const sessions = shuffleInPlace(
            (data.sessions ?? []).filter(
              (session) => session.sessionId !== selfId
            )
          );
          const reserveSelf = selfSlotReservedRef.current;
          const nextLive = emptyDiscoverySlots();
          const fillStart = reserveSelf ? 1 : 0;
          const capacity = slotCount - fillStart;
          sessions.slice(0, capacity).forEach((session, index) => {
            nextLive[fillStart + index] = session;
          });
          if (cancelled) return;
          setLiveSlots(nextLive);

          const nextArchives = await fillArchiveSlots(
            nextLive,
            archiveSlotsRef.current
          );
          if (cancelled) return;
          setArchiveSlots(nextArchives);
        }
      } catch {
        /* still reveal tiles — placeholders if fetch failed */
      } finally {
        if (!cancelled) {
          setDiscoveryReady(true);
        }
      }
    };

    void loadDiscovery();
    return () => {
      cancelled = true;
    };
  }, [discoveryEnabled, discoverySlotCount, fillArchiveSlots, room.id]);

  const hasEmptyDiscoveryTile = useMemo(() => {
    if (!discoveryEnabled) return false;
    const fillStart = isLive ? 1 : 0;
    for (let index = fillStart; index < discoverySlotCount; index++) {
      if (!liveSlots[index] && !archiveSlots[index]) return true;
    }
    return false;
  }, [
    archiveSlots,
    discoveryEnabled,
    discoverySlotCount,
    isLive,
    liveSlots
  ]);

  // While any tile is empty on the live page, re-check for new live sessions once a minute.
  useEffect(() => {
    if (!discoveryEnabled || !onDiscoveryPage || !hasEmptyDiscoveryTile) return;

    let cancelled = false;
    const EMPTY_TILE_POLL_MS = 60_000;

    const fillEmptyWithNewLives = async () => {
      const live = liveSlotsRef.current;
      const archives = archiveSlotsRef.current;
      const reserveSelf = selfSlotReservedRef.current;
      const fillStart = reserveSelf ? 1 : 0;
      const slotCount = discoverySlotCountRef.current;

      const emptyIndexes: number[] = [];
      for (let index = fillStart; index < slotCount; index++) {
        if (!live[index] && !archives[index]) {
          emptyIndexes.push(index);
        }
      }
      if (emptyIndexes.length === 0) return;

      try {
        const response = await fetch(
          `/api/live/sessions?roomId=${encodeURIComponent(room.id)}&limit=${slotCount}`
        );
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as {
          sessions?: LiveSessionView[];
        };

        const selfId = liveR2SessionIdRef.current;
        const usedSessionIds = new Set<string>();
        const usedUserIds = new Set<string>();
        const viewerId = viewerUserIdRef.current;
        if (viewerId) usedUserIds.add(viewerId);
        for (const session of live) {
          if (!session) continue;
          usedSessionIds.add(session.sessionId);
          usedUserIds.add(session.userId);
        }
        for (const archive of archives) {
          if (!archive) continue;
          usedSessionIds.add(archive.sessionId);
          usedUserIds.add(archive.userId);
        }
        if (selfId) usedSessionIds.add(selfId);

        const nextLive = [...live];
        let placed = 0;
        for (const session of shuffleInPlace([...(data.sessions ?? [])])) {
          if (placed >= emptyIndexes.length) break;
          if (usedSessionIds.has(session.sessionId)) continue;
          if (usedUserIds.has(session.userId)) continue;
          const slotIndex = emptyIndexes[placed];
          nextLive[slotIndex] = session;
          usedSessionIds.add(session.sessionId);
          usedUserIds.add(session.userId);
          placed += 1;
        }

        if (placed > 0 && !cancelled) {
          setLiveSlots(nextLive);
          liveSlotsRef.current = nextLive;
        }

        const nextArchives = await fillArchiveSlots(
          placed > 0 ? nextLive : live,
          archives
        );
        if (!cancelled) {
          archiveSlotsRef.current = nextArchives;
          setArchiveSlots(nextArchives);
        }
      } catch {
        /* optional */
      }
    };

    const timer = window.setInterval(() => {
      void fillEmptyWithNewLives();
    }, EMPTY_TILE_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    discoveryEnabled,
    discoverySlotCount,
    fillArchiveSlots,
    hasEmptyDiscoveryTile,
    onDiscoveryPage,
    room.id
  ]);

  const liveSessionForSlot = useCallback(
    (slot: number) => {
      if (!discoveryEnabled) return null;
      if (selfSlotReservedRef.current && slot === 0) return null;
      const session = liveSlots[slot];
      if (!session) return null;
      if (session.sessionId === liveR2SessionIdRef.current) return null;
      return session;
    },
    [discoveryEnabled, liveSlots]
  );

  const archiveSessionForSlot = useCallback(
    (slot: number) => {
      if (!discoveryEnabled) return null;
      if (selfSlotReservedRef.current && slot === 0) return null;
      if (liveSessionForSlot(slot)) return null;
      return archiveSlots[slot] ?? null;
    },
    [archiveSlots, discoveryEnabled, liveSessionForSlot]
  );

  /** Swap a bottom/rail session into a pinned slot without remounting players. */
  const promoteDiscoverySlot = useCallback(
    (fromSlot: number) => {
      if (fromSlot < 2) return;
      if (fromSlot >= discoverySlotCountRef.current) return;

      const pinnedTargets: number[] = [];
      if (!(selfSlotReservedRef.current && selfMainSlot === 0)) {
        pinnedTargets.push(0);
      }
      if (!(selfSlotReservedRef.current && selfMainSlot === 1)) {
        pinnedTargets.push(1);
      }
      if (pinnedTargets.length === 0) return;

      const occupied = (slot: number) =>
        Boolean(liveSlotsRef.current[slot] || archiveSlotsRef.current[slot]);

      const target =
        pinnedTargets.find((slot) => !occupied(slot)) ?? pinnedTargets[0];
      if (target === undefined || target === fromSlot) return;

      const nextLive = [...liveSlotsRef.current];
      const nextArchive = [...archiveSlotsRef.current];
      const liveTmp = nextLive[fromSlot] ?? null;
      nextLive[fromSlot] = nextLive[target] ?? null;
      nextLive[target] = liveTmp;
      const archiveTmp = nextArchive[fromSlot] ?? null;
      nextArchive[fromSlot] = nextArchive[target] ?? null;
      nextArchive[target] = archiveTmp;

      liveSlotsRef.current = nextLive;
      archiveSlotsRef.current = nextArchive;
      setLiveSlots(nextLive);
      setArchiveSlots(nextArchive);
    },
    [selfMainSlot]
  );

  const findLiveSlotBySessionId = useCallback((sessionId: string) => {
    return liveSlotsRef.current.findIndex(
      (session) => session?.sessionId === sessionId
    );
  }, []);

  const findArchiveSlotBySessionId = useCallback((sessionId: string) => {
    return archiveSlotsRef.current.findIndex(
      (session) => session?.sessionId === sessionId
    );
  }, []);

  const toggleGoLive = () => {
    if (isLive || isGoingLive) {
      stopCamera();
      return;
    }
    setWorkoutAcceptOpen(true);
  };

  const startBroadcastFromPromo = () => {
    if (isLive || isGoingLive || staticPreviewOnly) return;
    setWorkoutAcceptOpen(true);
  };

  const handleWorkoutAcceptDecision = (
    decision: "accept" | "skip",
    sessionIndex: number | null
  ) => {
    if (decision === "accept") {
      setAcceptedPlanDayIndex(sessionIndex);
    }
    setWorkoutAcceptOpen(false);
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
    <div
      className={`live-rooms-immersive${blurred ? " is-blurred" : ""}`}
      aria-hidden={blurred || undefined}
    >
      <WorkoutAcceptPrompt
        plan={workoutPlan}
        open={workoutAcceptOpen}
        onClose={() => setWorkoutAcceptOpen(false)}
        onDecision={handleWorkoutAcceptDecision}
      />
      <header className="live-rooms-immersive-header">
        <button
          className={`live-rooms-immersive-action${isLive ? " live-rooms-immersive-action--live" : ""}`}
          disabled={isGoingLive || staticPreviewOnly}
          onClick={toggleGoLive}
          type="button"
        >
          {isGoingLive ? "Starting…" : isLive ? "End Live" : "Go Live"}
        </button>
        <div className="live-rooms-immersive-title-wrap">
          <button
            type="button"
            className="live-rooms-immersive-nav"
            aria-label="Previous page"
            onClick={showPreviousPage}
          >
            &lt;
          </button>
          <h1 className="live-rooms-immersive-title">
            {onDiscoveryPage ? room.title : "Rooms chat"}
          </h1>
          <button
            type="button"
            className="live-rooms-immersive-nav"
            aria-label="Next page"
            onClick={showNextPage}
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
        {viewTimerPercent !== null ? (
          <div
            className="live-rooms-view-timer"
            role="progressbar"
            aria-label={
              tier === "guest"
                ? "Guest view time remaining"
                : "Broadcast time remaining"
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(viewTimerPercent)}
          >
            <div
              className="live-rooms-view-timer-fill"
              style={{ width: `${viewTimerPercent}%` }}
            />
          </div>
        ) : null}
      </header>

      <div className="live-rooms-immersive-body">
        {!onDiscoveryPage ? (
          <section className="live-rooms-messages-page" aria-label="Rooms chat">
            <div className="live-rooms-messages-list">
              {chatLoading ? (
                <p className="live-rooms-messages-status">Loading logs…</p>
              ) : null}
              {!chatLoading && messages.length === 0 ? (
                <p className="live-rooms-messages-status">
                  No workout logs yet. Log your first set below.
                </p>
              ) : null}
              {messages.map((message) => {
                const isSelf = Boolean(
                  authUser?.id && message.senderId === authUser.id
                );
                return (
                  <article
                    className={`live-rooms-messages-item is-workout-log${
                      isSelf ? " is-self" : " is-other"
                    }`}
                    key={message.id}
                  >
                    <LobbyWorkoutLogCard message={message} />
                  </article>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            {chatError ? (
              <p className="live-rooms-messages-error">{chatError}</p>
            ) : null}
            <LobbyChatComposer
              onSendWorkoutLog={(created) => {
                setMessages((prev) => {
                  if (prev.some((message) => message.id === created.id)) {
                    return prev;
                  }
                  return [...prev, created];
                });
              }}
              disabled={tier === "guest"}
              exerciseOptions={logExerciseOptions}
              planDayIndex={logPlanDayIndex}
              inputId="immersive-chat-input"
              classPrefix="live-rooms-messages"
            />
          </section>
        ) : !discoveryReady ? (
          <div
            className="live-rooms-discovery-loading"
            role="status"
            aria-live="polite"
          >
            <span className="live-rooms-discovery-loading-spinner" aria-hidden />
            <p>Loading live rooms…</p>
          </div>
        ) : (
          <>
            <div className="live-rooms-discovery-stage">
              {isLive ? (
                <div
                  aria-label="Your live feed"
                  className="live-rooms-preview-tile live-rooms-immersive-pinned-tile"
                  role="group"
                  style={{
                    gridArea: selfMainSlot === 0 ? "pin0" : "pin1"
                  }}
                >
                  <video
                    autoPlay
                    className="live-rooms-featured-video"
                    muted
                    playsInline
                    ref={attachStreamToVideo}
                  />
                  <span className="live-rooms-featured-label">You</span>
                </div>
              ) : null}

              {Array.from({ length: discoverySlotCount }, (_, slot) => {
                if (isLive && slot === selfMainSlot) return null;
                if (liveSessionForSlot(slot) || archiveSessionForSlot(slot)) {
                  return null;
                }
                const placeholder = placeholderForDiscoverySlot(layout, slot);
                const featured = slot < 2;
                return (
                  <EmptyDiscoveryTile
                    key={`empty-${slot}`}
                    className={
                      featured
                        ? "live-rooms-immersive-pinned-tile"
                        : slot < 6
                          ? "live-rooms-immersive-bottom-tile"
                          : "live-rooms-immersive-rail-tile"
                    }
                    featured={featured}
                    image={placeholder.image}
                    onGoLive={startBroadcastFromPromo}
                    onUpgrade={onRequestUpgrade}
                    priority={slot === 0}
                    sizes={
                      featured
                        ? "(max-width: 960px) 50vw, 38vw"
                        : slot < 6
                          ? "(max-width: 960px) 50vw, 180px"
                          : "200px"
                    }
                    slotIndex={slot}
                    style={{ gridArea: discoveryGridArea(slot) }}
                  />
                );
              })}

              {Array.from({ length: discoverySlotCount }, (_, slot) => {
                if (isLive && slot === selfMainSlot) return null;
                const liveSession = liveSessionForSlot(slot);
                const archiveSession = archiveSessionForSlot(slot);
                const session = liveSession ?? archiveSession;
                if (!session) return null;

                const mode = liveSession ? ("live" as const) : ("archive" as const);
                const featured = slot < 2;
                const promotable = slot >= 2;
                const tileLabel =
                  session.displayName?.trim() ||
                  placeholderForDiscoverySlot(layout, slot).name;
                const tileAuthor = session.author ?? null;

                return (
                  <div
                    aria-label={
                      promotable
                        ? `${tileLabel}. Activate to show in a large tile.`
                        : tileLabel
                    }
                    className={discoveryTileClassName(slot, promotable)}
                    key={session.sessionId}
                    onClick={
                      promotable
                        ? (event) => {
                            if (
                              (event.target as HTMLElement).closest(
                                ".live-rooms-tile-author-hover, .feed-author-card"
                              )
                            ) {
                              return;
                            }
                            promoteDiscoverySlot(slot);
                          }
                        : undefined
                    }
                    onKeyDown={
                      promotable
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              promoteDiscoverySlot(slot);
                            }
                          }
                        : undefined
                    }
                    role={promotable ? "button" : "group"}
                    style={{ gridArea: discoveryGridArea(slot) }}
                    tabIndex={promotable ? 0 : undefined}
                  >
                    <ChunkPreviewPlayer
                      availableChunks={
                        mode === "archive" ? session.availableChunks : null
                      }
                      className={
                        featured
                          ? "live-rooms-featured-hls"
                          : "live-rooms-tile-video"
                      }
                      initialLastChunk={session.lastChunkNumber}
                      label={tileLabel}
                      mode={mode}
                      onDead={() => {
                        if (liveSession) {
                          const currentSlot = findLiveSlotBySessionId(
                            session.sessionId
                          );
                          if (currentSlot >= 0) {
                            void replaceLiveSlot(currentSlot, session.sessionId);
                          }
                          return;
                        }
                        const currentSlot = findArchiveSlotBySessionId(
                          session.sessionId
                        );
                        if (currentSlot >= 0) {
                          void replaceArchiveSlot(
                            currentSlot,
                            session.sessionId
                          );
                        }
                      }}
                      paused={pauseIncoming}
                      r2Folder={session.r2Folder}
                      sessionId={
                        mode === "archive" ? session.sessionId : undefined
                      }
                    />
                    <TileUserLabel
                      author={tileAuthor}
                      label={tileLabel}
                      labelPosition={featured ? "left" : "center"}
                      variant={featured ? "featured" : "tile"}
                    />
                  </div>
                );
              })}
            </div>
            {cameraError ? (
              <p className="live-rooms-camera-error live-rooms-camera-error--stage" role="alert">
                {cameraError}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ComingSoonModal({
  title,
  body,
  onClose
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
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
        <h3 id="room-coming-soon-title">{title}</h3>
        <p>{body}</p>
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
  const {
    tier,
    remainingSeconds,
    refreshStatus
  } = useEntitlements();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<LobbyMessageView[]>([]);
  const [chatMinimized, setChatMinimized] = useState(true);
  const [privateRoomModalOpen, setPrivateRoomModalOpen] = useState(false);
  const [comingSoonRoomTitle, setComingSoonRoomTitle] = useState<string | null>(
    null
  );
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lobbyWorkoutPlan, setLobbyWorkoutPlan] = useState<WorkoutPlan | null>(
    null
  );
  const { user: authUser } = useAuth();
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(
    null
  );
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const profileCacheRef = useRef(
    new Map<string, Awaited<ReturnType<typeof fetchLobbySenderProfile>>>()
  );

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (tier !== "guest") {
      setChatMinimized(false);
    }
  }, [tier]);

  useEffect(() => {
    if (!authUser?.id) {
      setLobbyWorkoutPlan(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("workout_plan")
          .eq("id", authUser.id)
          .maybeSingle();
        if (cancelled) return;
        const raw = data?.workout_plan ?? null;
        setLobbyWorkoutPlan(
          raw ? normalizeWorkoutPlan(raw) ?? (raw as WorkoutPlan) : null
        );
      } catch {
        if (!cancelled) setLobbyWorkoutPlan(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, supabase]);

  const lobbyLogPlanDayIndex = useMemo(() => {
    if (!lobbyWorkoutPlan) return null;
    return (
      buildWeekDaySlots(lobbyWorkoutPlan, startOfWeekMonday(new Date())).find(
        (slot) => slot.isToday
      )?.sessionIndex ?? null
    );
  }, [lobbyWorkoutPlan]);

  const lobbyExerciseOptions = useMemo(
    () => exerciseNamesFromPlan(lobbyWorkoutPlan, lobbyLogPlanDayIndex),
    [lobbyWorkoutPlan, lobbyLogPlanDayIndex]
  );

  const stubUpgrade = async () => {
    setUpgradeReason(null);
    setPlanModalOpen(true);
  };

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
        setMessages(rows.filter((row) => row.messageType === "workout_log"));
        for (const row of rows) {
          if (row.messageType !== "workout_log") continue;
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
            if (view.messageType !== "workout_log") return;
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

  return (
    <>
      <div
        className={`room-select-shell${
          chatMinimized || tier === "guest" ? " is-chat-minimized" : ""
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

          {tier === "free" ? (
            <p className="room-select-quota">
              {formatRemainingTime(remainingSeconds)} broadcast
              {" · "}
              <button
                type="button"
                className="room-select-upgrade-link"
                onClick={() => setPlanModalOpen(true)}
              >
                Go Premium
              </button>
            </p>
          ) : null}

          <div className="room-select-grid">
            {filteredRooms.map((room) => {
              const comingSoon = isRoomComingSoon(room.id);
              const guestLocked = !comingSoon && !canAccessRoom(tier, room.id);
              if (comingSoon || guestLocked) {
                return (
                  <div
                    className="room-select-card is-locked"
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
                      <span>{comingSoon ? "Coming soon" : "Locked"}</span>
                    </div>
                    <button
                      type="button"
                      className="room-select-card-lock"
                      onClick={() => {
                        if (comingSoon) {
                          setComingSoonRoomTitle(room.title);
                          return;
                        }
                        setUpgradeReason("locked_room");
                      }}
                    >
                      {comingSoon ? (
                        <>
                          <strong>Coming soon</strong>
                          <span>Stay tuned</span>
                        </>
                      ) : (
                        <>
                          <strong>Sign in to unlock</strong>
                          <span>Guests can try {GUEST_ROOM_ID}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              }

              return (
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
              );
            })}

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

        {chatMinimized || tier === "guest" ? (
          <button
            type="button"
            className="room-select-chat-restore"
            aria-label="Expand chat"
            title="Expand chat"
            onClick={() => {
              if (tier === "guest") {
                setUpgradeReason("guest_feed_end");
                return;
              }
              setChatMinimized(false);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden fill="none">
              <path
                d="M5.75 6.75h12.5A2 2 0 0 1 20.25 8.75v6.5a2 2 0 0 1-2 2H11l-3.75 2.5V17.25h-1.5a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
            <span>Rooms chat</span>
          </button>
        ) : (
          <aside className="room-select-chat">
            <div className="room-select-chat-header">
              <strong>Rooms chat</strong>
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
                <p className="room-select-chat-status">Loading logs…</p>
              ) : null}
              {!chatLoading && messages.length === 0 ? (
                <p className="room-select-chat-status">
                  No workout logs yet. Log your first set below.
                </p>
              ) : null}
              {messages.map((message) => {
                const isSelf = Boolean(
                  authUser?.id && message.senderId === authUser.id
                );
                return (
                  <article
                    className={`room-select-chat-item is-workout-log${
                      isSelf ? " is-self" : " is-other"
                    }`}
                    key={message.id}
                  >
                    <LobbyWorkoutLogCard
                      message={message}
                      className="room-select-workout-log"
                    />
                  </article>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            {chatError ? (
              <p className="room-select-chat-error">{chatError}</p>
            ) : null}
            <LobbyChatComposer
              onSendWorkoutLog={(created) => {
                setMessages((prev) => {
                  if (prev.some((message) => message.id === created.id)) {
                    return prev;
                  }
                  return [...prev, created];
                });
              }}
              disabled={false}
              exerciseOptions={lobbyExerciseOptions}
              planDayIndex={lobbyLogPlanDayIndex}
              inputId="room-chat-input"
              classPrefix="room-select-chat"
            />
          </aside>
        )}
      </div>

      {privateRoomModalOpen ? (
        <ComingSoonModal
          title="Coming Soon"
          body="Private Sessions will let trainers and gyms host invitation-only live workouts, coaching sessions, and fitness classes."
          onClose={() => setPrivateRoomModalOpen(false)}
        />
      ) : null}

      {comingSoonRoomTitle ? (
        <ComingSoonModal
          title={`${comingSoonRoomTitle} — Coming Soon`}
          body={`The ${comingSoonRoomTitle} room isn’t open yet. We’re building more live spaces — check back soon.`}
          onClose={() => setComingSoonRoomTitle(null)}
        />
      ) : null}

      <UpgradePrompt
        open={Boolean(upgradeReason)}
        reason={upgradeReason ?? "locked_room"}
        onClose={() => setUpgradeReason(null)}
        onStubUpgrade={stubUpgrade}
      />

      <PremiumPlanModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
      />
    </>
  );
}
