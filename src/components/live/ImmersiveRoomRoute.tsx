"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { ImmersiveRoom } from "@/components/live/LiveRoomsExperience";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import {
  getOrCreateClientGuestId,
  syncClientGuestId
} from "@/lib/guest-client-id";
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
  remainingSeconds: number | null;
  quotaSeconds: number;
};

export function ImmersiveRoomRoute({ room }: { room: WorkoutRoom }) {
  const router = useRouter();
  const joinedAtRef = useRef(Date.now());
  const lastBeatRef = useRef(Date.now());
  const recordedRef = useRef(false);
  const fingerprintRef = useRef("");
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const [access, setAccess] = useState<StartOk | null>(null);
  const [blocking, setBlocking] = useState(true);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(
    null
  );
  const [upgradeBusy, setUpgradeBusy] = useState(false);
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
    const seconds = Math.round((Date.now() - lastBeatRef.current) / 1000);
    try {
      const response = await fetch("/api/room-access/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint: fingerprintRef.current,
          clientGuestId: getOrCreateClientGuestId(),
          seconds
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

  const leaveRoom = useCallback(() => {
    stopHeartbeat();
    // Navigate immediately; flush access/hours in the background.
    void leaveAccess();
    void flushHours();
    void exitFullscreen();
    router.push("/rooms");
  }, [flushHours, leaveAccess, router, stopHeartbeat]);

  const showLimitModal = useCallback(
    (reason: UpgradeReason, tier: Tier = "guest") => {
      stopHeartbeat();
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
    [flushHours, leaveAccess, stopHeartbeat]
  );

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
          if (data.reason === "guest_time" || data.reason === "free_time") {
            setAccess({
              allowed: true,
              tier: data.tier ?? "guest",
              remainingSeconds: 0,
              quotaSeconds:
                data.quotaSeconds ??
                (data.tier === "guest" ? GUEST_VIEW_SECONDS : 0)
            });
            setUpgradeReason(data.reason);
            return;
          }
          if (data.reason === "locked_room") {
            setUpgradeReason("locked_room");
            return;
          }
          setGateMessage(data.message ?? "Could not join this room.");
          return;
        }

        setAccess({
          allowed: true,
          tier: data.tier ?? "guest",
          remainingSeconds: data.remainingSeconds ?? null,
          quotaSeconds: data.quotaSeconds ?? 0
        });
        joinedAtRef.current = Date.now();
        lastBeatRef.current = Date.now();
        recordedRef.current = false;

        heartbeatTimerRef.current = setInterval(() => {
          void (async () => {
            const seconds = Math.round(
              (Date.now() - lastBeatRef.current) / 1000
            );
            lastBeatRef.current = Date.now();
            try {
              const beat = await fetch("/api/room-access/heartbeat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fingerprint: fingerprintRef.current,
                  clientGuestId: getOrCreateClientGuestId(),
                  seconds: Math.max(seconds, ROOM_HEARTBEAT_SECONDS)
                })
              });
              const payload = (await beat.json()) as {
                exhausted?: boolean;
                reason?: UpgradeReason;
                guestId?: string | null;
                remainingSeconds?: number | null;
              };
              syncClientGuestId(payload.guestId);
              if (
                typeof payload.remainingSeconds === "number" ||
                payload.remainingSeconds === null
              ) {
                setAccess((prev) =>
                  prev
                    ? {
                        ...prev,
                        remainingSeconds: payload.remainingSeconds ?? null
                      }
                    : prev
                );
              }
              if (payload.exhausted && payload.reason) {
                showLimitModal(payload.reason);
              }
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
      window.removeEventListener("pagehide", onPageHide);
      void leaveAccess();
      void flushHours();
    };
  }, [flushHours, leaveAccess, room.id, showLimitModal, stopHeartbeat]);

  const stubUpgrade = async () => {
    setUpgradeBusy(true);
    try {
      const response = await fetch("/api/billing/stub-upgrade", {
        method: "POST"
      });
      if (!response.ok) throw new Error("Upgrade failed");
      setUpgradeReason(null);
      window.location.reload();
    } catch {
      setGateMessage("Could not upgrade. Try signing in first.");
    } finally {
      setUpgradeBusy(false);
    }
  };

  const limitReached =
    upgradeReason === "guest_time" || upgradeReason === "free_time";

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
          busy={upgradeBusy}
          primaryHref={
            upgradeReason
              ? `/login?next=/rooms/${encodeURIComponent(room.id)}`
              : undefined
          }
          onClose={() => {
            setUpgradeReason(null);
            router.push("/rooms");
          }}
          onStubUpgrade={stubUpgrade}
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
        staticPreviewOnly={limitReached}
        blurred={limitReached}
      />
      <UpgradePrompt
        open={Boolean(upgradeReason)}
        reason={upgradeReason ?? "free_time"}
        busy={upgradeBusy}
        primaryHref={
          upgradeReason === "go_live_auth" ||
          upgradeReason === "guest_time" ||
          upgradeReason === "free_time"
            ? `/login?next=/rooms/${encodeURIComponent(room.id)}`
            : undefined
        }
        onClose={() => {
          const reason = upgradeReason;
          setUpgradeReason(null);
          if (reason === "go_live_auth") return;
          router.push("/rooms");
        }}
        onStubUpgrade={stubUpgrade}
      />
    </div>
  );
}
