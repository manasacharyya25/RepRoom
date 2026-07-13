"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { ImmersiveRoom } from "@/components/live/LiveRoomsExperience";
import { exitFullscreen } from "@/lib/fullscreen";
import { addLiveHours } from "@/lib/onboarding";
import type { WorkoutRoom } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/client";

export function ImmersiveRoomRoute({ room }: { room: WorkoutRoom }) {
  const router = useRouter();
  const joinedAtRef = useRef(Date.now());
  const recordedRef = useRef(false);

  const flushHours = useCallback(async () => {
    if (recordedRef.current) return;
    recordedRef.current = true;

    const elapsedMs = Date.now() - joinedAtRef.current;
    const hours = elapsedMs / (1000 * 60 * 60);
    // Ignore tiny accidental visits under ~30 seconds
    if (hours < 30 / 3600) return;

    try {
      const supabase = createClient();
      await addLiveHours(supabase, hours);
    } catch {
      recordedRef.current = false;
    }
  }, []);

  const leaveRoom = useCallback(async () => {
    await flushHours();
    await exitFullscreen();
    router.push("/rooms");
  }, [flushHours, router]);

  useEffect(() => {
    joinedAtRef.current = Date.now();
    recordedRef.current = false;

    const onPageHide = () => {
      void flushHours();
    };

    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      void flushHours();
    };
  }, [flushHours, room.id]);

  return <ImmersiveRoom onLeave={leaveRoom} room={room} />;
}
