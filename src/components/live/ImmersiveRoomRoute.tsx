"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ImmersiveRoom } from "@/components/live/LiveRoomsExperience";
import { exitFullscreen } from "@/lib/fullscreen";
import type { WorkoutRoom } from "@/lib/rooms";

export function ImmersiveRoomRoute({ room }: { room: WorkoutRoom }) {
  const router = useRouter();

  const leaveRoom = useCallback(async () => {
    await exitFullscreen();
    router.push("/rooms");
  }, [router]);

  return <ImmersiveRoom onLeave={leaveRoom} room={room} />;
}
