"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { PremiumPlanModal } from "@/components/billing/PremiumPlanModal";
import { ImmersiveRoom } from "@/components/live/LiveRoomsExperience";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import {
  getOrCreateClientGuestId,
  syncClientGuestId
} from "@/lib/guest-client-id";
import {
  addGuestViewSeconds,
  getGuestViewRemainingSeconds
} from "@/lib/guest-view-quota";
import {
  GUEST_VIEW_SECONDS,
  ROOM_HEARTBEAT_SECONDS,
  type Tier,
  type UpgradeReason
} from "@/lib/entitlements";
import { exitFullscreen } from "@/lib/fullscreen";
import { addLiveHours } from "@/lib/onboarding";
import type { WorkoutRoom } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/client";
import "@/app/billing.css";

type StartOk = {
  allowed: true;
  tier: Tier;
  /** Broadcast remaining for free users; guest view remaining is local. */
  remainingSeconds: number | null;
  quotaSeconds: number;
};

export function ImmersiveRoomRoute({ room }: { room: WorkoutRoom }) {
  const router = useRouter();
  const joinedAtRef = useRef(Date.now());
  const recordedRef = useRef(false);
  const fingerprintRef = useRef("");
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const guestTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [access, setAccess] = useState<StartOk | null>(null);
  const [blocking, setBlocking] = useState(true);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(
    null
  );
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [gateMessage, setGateMessage] = useState<string | null>(null);

  const flushHours = useCallback(async () => {
    if (recordedRef.current) return;
    recordedRef.current = true;

    const elapsedMs = Date.now() - joinedAtRef.current;
    const hours = elapsedMs / (1000 * 60 * 60);
    if (hours < 30 / 3600) return;

    try {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      await addLiveHours(supabase, hours);
    } catch {
      recordedRef.current = false;
    }
  }, []);

  const leaveAccess = useCallback(async () => {
    try {
      const response = await fetch("/api/room-access/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint: fingerprintRef.current,
          clientGuestId: getOrCreateClientGuestId()
        }),
        keepalive: true
      });
      const data = (await response.json().catch(() => null)) as {
        guestId?: string | null;
      } | null;
      syncClientGuestId(data?.guestId);
    } catch {
      /* ignore */
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const stopGuestTimer = useCallback(() => {
    if (guestTimerRef.current) {
      clearInterval(guestTimerRef.current);
      guestTimerRef.current = null;
    }
  }, []);

  const leaveRoom = useCallback(() => {
    stopHeartbeat();
    stopGuestTimer();
    void leaveAccess();
    void flushHours();
    void exitFullscreen();
    router.push("/rooms");
  }, [flushHours, leaveAccess, router, stopGuestTimer, stopHeartbeat]);

  const showLimitModal = useCallback(
    (reason: UpgradeReason, tier: Tier = "guest") => {
      stopHeartbeat();
      stopGuestTimer();
      setAccess((prev) =>
        prev
          ? { ...prev, remainingSeconds: 0 }
          : {
              allowed: true,
              tier,
              remainingSeconds: 0,
              quotaSeconds: tier === "guest" ? GUEST_VIEW_SECONDS : 0
            }
      );
      setUpgradeReason(reason);
      void leaveAccess();
      void flushHours();
      void exitFullscreen();
    },
    [flushHours, leaveAccess, stopGuestTimer, stopHeartbeat]
  );

  const startGuestViewTimer = useCallback(() => {
    stopGuestTimer();
    guestTimerRef.current = setInterval(() => {
      const remaining = addGuestViewSeconds(1);
      setAccess((prev) =>
        prev ? { ...prev, remainingSeconds: remaining } : prev
      );
      if (remaining <= 0) {
        showLimitModal("guest_time", "guest");
      }
    }, 1000);
  }, [showLimitModal, stopGuestTimer]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setBlocking(true);
      try {
        const fingerprint = await getDeviceFingerprint();
        fingerprintRef.current = fingerprint;
        const clientGuestId = getOrCreateClientGuestId();

        const response = await fetch("/api/room-access/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id, fingerprint, clientGuestId })
        });
        const data = (await response.json()) as {
          allowed?: boolean;
          reason?: UpgradeReason | "device_conflict";
          message?: string;
          tier?: Tier;
          remainingSeconds?: number | null;
          quotaSeconds?: number;
          guestId?: string | null;
        };
        syncClientGuestId(data.guestId);

        if (cancelled) return;

        if (!response.ok || !data.allowed) {
          if (data.reason === "device_conflict") {
            setGateMessage(
              data.message ??
                "Already active on another device. Sign in for a full account."
            );
            setUpgradeReason("locked_room");
            return;
          }
          if (data.reason === "locked_room") {
            setUpgradeReason("locked_room");
            return;
          }
          setGateMessage(data.message ?? "Could not join this room.");
          return;
        }

        const tier = data.tier ?? "guest";

        if (tier === "guest") {
          const remaining = getGuestViewRemainingSeconds();
          setAccess({
            allowed: true,
            tier: "guest",
            remainingSeconds: remaining,
            quotaSeconds: GUEST_VIEW_SECONDS
          });
          joinedAtRef.current = Date.now();
          recordedRef.current = false;

          if (remaining <= 0) {
            setUpgradeReason("guest_time");
          } else {
            startGuestViewTimer();
          }
        } else {
          setAccess({
            allowed: true,
            tier,
            remainingSeconds: data.remainingSeconds ?? null,
            quotaSeconds: data.quotaSeconds ?? 0
          });
          joinedAtRef.current = Date.now();
          recordedRef.current = false;
        }

        heartbeatTimerRef.current = setInterval(() => {
          void (async () => {
            try {
              const beat = await fetch("/api/room-access/heartbeat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fingerprint: fingerprintRef.current,
                  clientGuestId: getOrCreateClientGuestId()
                })
              });
              const payload = (await beat.json()) as {
                guestId?: string | null;
              };
              syncClientGuestId(payload.guestId);
            } catch {
              /* ignore transient */
            }
          })();
        }, ROOM_HEARTBEAT_SECONDS * 1000);
      } catch {
        if (!cancelled) {
          setGateMessage("Could not check room access. Try again.");
        }
      } finally {
        if (!cancelled) setBlocking(false);
      }
    };

    void boot();

    const onPageHide = () => {
      void leaveAccess();
      void flushHours();
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      stopHeartbeat();
      stopGuestTimer();
      window.removeEventListener("pagehide", onPageHide);
      void leaveAccess();
      void flushHours();
    };
  }, [
    flushHours,
    leaveAccess,
    room.id,
    startGuestViewTimer,
    stopGuestTimer,
    stopHeartbeat
  ]);

  const openPlanModal = () => {
    setUpgradeReason(null);
    setPlanModalOpen(true);
  };

  const onBroadcastRemaining = useCallback((remaining: number | null) => {
    setAccess((prev) =>
      prev ? { ...prev, remainingSeconds: remaining } : prev
    );
  }, []);

  const onBroadcastLimitReached = useCallback(() => {
    setUpgradeReason("free_time");
  }, []);

  const limitReached = upgradeReason === "guest_time";

  if (blocking) {
    return (
      <div className="room-access-gate">
        <p>Checking access…</p>
      </div>
    );
  }

  if (!access) {
    return (
      <div className="room-access-gate">
        <p>{gateMessage ?? "This room isn’t available."}</p>
        <button
          type="button"
          className="upgrade-prompt-btn"
          onClick={() => router.push("/rooms")}
        >
          Back to rooms
        </button>
        <UpgradePrompt
          open={Boolean(upgradeReason)}
          reason={upgradeReason ?? "locked_room"}
          primaryHref={
            upgradeReason
              ? `/login?next=/rooms/${encodeURIComponent(room.id)}`
              : undefined
          }
          onClose={() => {
            setUpgradeReason(null);
            router.push("/rooms");
          }}
          onStubUpgrade={openPlanModal}
        />
        <PremiumPlanModal
          open={planModalOpen}
          onClose={() => setPlanModalOpen(false)}
          onContinue={() => setPlanModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className={limitReached ? "live-rooms-limit-shell" : undefined}>
      <ImmersiveRoom
        onLeave={leaveRoom}
        room={room}
        tier={access.tier}
        remainingSeconds={access.remainingSeconds}
        quotaSeconds={access.quotaSeconds}
        onNeedSignInToGoLive={() => setUpgradeReason("go_live_auth")}
        onBroadcastRemaining={onBroadcastRemaining}
        onBroadcastLimitReached={onBroadcastLimitReached}
        staticPreviewOnly={limitReached}
        blurred={limitReached}
      />
      <UpgradePrompt
        open={Boolean(upgradeReason)}
        reason={upgradeReason ?? "free_time"}
        primaryHref={
          upgradeReason === "go_live_auth" || upgradeReason === "guest_time"
            ? `/login?next=/rooms/${encodeURIComponent(room.id)}`
            : undefined
        }
        onClose={() => {
          const reason = upgradeReason;
          setUpgradeReason(null);
          if (reason === "go_live_auth" || reason === "free_time") return;
          router.push("/rooms");
        }}
        onStubUpgrade={openPlanModal}
      />
      <PremiumPlanModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onContinue={() => setPlanModalOpen(false)}
      />
    </div>
  );
}
