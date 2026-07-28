"use client";

import dynamic from "next/dynamic";

const LiveRoomsExperience = dynamic(
  () =>
    import("@/components/live/LiveRoomsExperience").then(
      (mod) => mod.LiveRoomsExperience
    ),
  {
    loading: () => (
      <div className="app-route-loading" role="status" aria-live="polite">
        <div className="app-route-loading-spinner" aria-hidden="true" />
        <p>Loading rooms…</p>
      </div>
    ),
    ssr: false
  }
);

export function RoomsExperienceLoader() {
  return <LiveRoomsExperience />;
}
