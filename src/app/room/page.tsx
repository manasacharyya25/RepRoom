import { Suspense } from "react";
import { RoomExperience } from "@/components/RoomExperience";

export default function RoomPage() {
  return (
    <Suspense fallback={null}>
      <RoomExperience />
    </Suspense>
  );
}
