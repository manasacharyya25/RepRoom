import { Suspense } from "react";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { ProfilePageSkeleton } from "@/components/profile/ProfilePageSkeleton";
import { getCurrentProfileView } from "@/lib/profile-data";

async function ProfileContent() {
  const profileData = await getCurrentProfileView();
  return <ProfilePage initialData={profileData} />;
}

export default function ProfileRoutePage() {
  return (
    <main className="profile-main">
      <Suspense fallback={<ProfilePageSkeleton />}>
        <ProfileContent />
      </Suspense>
    </main>
  );
}
