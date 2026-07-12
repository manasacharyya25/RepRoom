import { Suspense } from "react";
import { PreviewExperience } from "@/components/PreviewExperience";

export default function PreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviewExperience />
    </Suspense>
  );
}
