"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { ImmersiveRoom } from "@/components/live/LiveRoomsExperience";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import {
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
      await fetch("/api/room-access/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint: fingerprintRef.current,
          seconds
        }),
        keepalive: true
      });
    } catch {
      /* ignore */
    }
  }, []);

  const leaveRoom = useCallback(async () => {
    await leaveAccess();
    await flushHours();
    await exitFullscreen();
    router.push("/rooms");
  }, [flushHours, leaveAccess, router]);

  const forceLeaveWithUpgrade = useCallback(
    (reason: UpgradeReason) => {
      setUpgradeReason(reason);
      void leaveAccess();
      void flushHours();
      void exitFullscreen();
    },
    [flushHours, leaveAccess]
  );

  useEffect(() => {
    let cancelled = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const boot = async () => {
      setBlocking(true);
      const fingerprint = await getDeviceFingerprint();
      fingerprintRef.current = fingerprint;

      const response = await fetch("/api/room-access/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, fingerprint })
      });
      const data = (await response.json()) as {
        allowed?: boolean;
        reason?: UpgradeReason | "device_conflict";
        message?: string;
        tier?: Tier;
        remainingSeconds?: number | null;
        quotaSeconds?: number;
      };

      if (cancelled) return;

      if (!response.ok || !data.allowed) {
        setBlocking(false);
        if (data.reason === "device_conflict") {
          setGateMessage(
            data.message ?? "Already active on another device. Sign in for a full account."
          );
          setUpgradeReason("locked_room");
          return;
        }
        if (
          data.reason === "locked_room" ||
          data.reason === "guest_time" ||
          data.reason === "free_time"
        ) {
          setUpgradeReason(data.reason);
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
      setBlocking(false);
      joinedAtRef.current = Date.now();
      lastBeatRef.current = Date.now();
      recordedRef.current = false;

      heartbeatTimer = setInterval(() => {
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
                seconds: Math.max(seconds, ROOM_HEARTBEAT_SECONDS)
              })
            });
            const payload = (await beat.json()) as {
              exhausted?: boolean;
              reason?: UpgradeReason;
            };
            if (payload.exhausted && payload.reason) {
              forceLeaveWithUpgrade(payload.reason);
            }
          } catch {
            /* ignore transient */
          }
        })();
      }, ROOM_HEARTBEAT_SECONDS * 1000);
    };

    void boot();

    const onPageHide = () => {
      void leaveAccess();
      void flushHours();
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      window.removeEventListener("pagehide", onPageHide);
      void leaveAccess();
      void flushHours();
    };
  }, [flushHours, forceLeaveWithUpgrade, leaveAccess, room.id]);

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
        <button type="button" className="upgrade-prompt-btn" onClick={() => router.push("/rooms")}>
          Back to rooms
        </button>
        <UpgradePrompt
          open={Boolean(upgradeReason)}
          reason={upgradeReason ?? "locked_room"}
          busy={upgradeBusy}
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
    <>
      <ImmersiveRoom
        onLeave={leaveRoom}
        room={room}
        tier={access.tier}
        remainingSeconds={access.remainingSeconds}
      />
      <UpgradePrompt
        open={Boolean(upgradeReason)}
        reason={upgradeReason ?? "free_time"}
        busy={upgradeBusy}
        onClose={() => {
          setUpgradeReason(null);
          router.push("/rooms");
        }}
        onStubUpgrade={stubUpgrade}
      />
    </>
  );
}
