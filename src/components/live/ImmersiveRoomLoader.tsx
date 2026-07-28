"use client";

import dynamic from "next/dynamic";
import type { WorkoutRoom } from "@/lib/rooms";

const ImmersiveRoomRoute = dynamic(
  () =>
    import("@/components/live/ImmersiveRoomRoute").then(
      (mod) => mod.ImmersiveRoomRoute
    ),
  {
    loading: () => (
      <div className="app-route-loading" role="status" aria-live="polite">
        <div className="app-route-loading-spinner" aria-hidden="true" />
        <p>Loading room…</p>
      </div>
    ),
    ssr: false
  }
);

export function ImmersiveRoomLoader({ room }: { room: WorkoutRoom }) {
  return <ImmersiveRoomRoute room={room} />;
}
