import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { ProfilePageSkeleton } from "@/components/profile/ProfilePageSkeleton";
import {
  getCurrentProfileView,
  getProfileViewByUsername
} from "@/lib/profile-data";

async function PublicProfileContent({ handle }: { handle: string }) {
  const [viewer, profileData] = await Promise.all([
    getCurrentProfileView(),
    getProfileViewByUsername(handle)
  ]);

  if (!profileData) notFound();

  if (
    viewer?.profile.username &&
    viewer.profile.username.toLowerCase() === handle
  ) {
    redirect("/profile");
  }

  return <ProfilePage initialData={profileData} readOnly />;
}

export default async function PublicProfilePage({
  params
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const handle = decodeURIComponent(username).trim().toLowerCase();
  if (!handle) notFound();

  return (
    <main className="profile-main">
      <Suspense fallback={<ProfilePageSkeleton />}>
        <PublicProfileContent handle={handle} />
      </Suspense>
    </main>
  );
}
