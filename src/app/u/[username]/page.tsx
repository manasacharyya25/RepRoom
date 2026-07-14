import { notFound, redirect } from "next/navigation";
import { AppNav } from "@/components/nav/AppNav";
import { ProfilePage } from "@/components/profile/ProfilePage";
import {
  getCurrentProfileView,
  getProfileViewByUsername
} from "@/lib/profile-data";
import "@/app/landing.css";
import "@/app/feed.css";
import "@/app/profile.css";

export default async function PublicProfilePage({
  params
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const handle = decodeURIComponent(username).trim().toLowerCase();
  if (!handle) notFound();

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

  return (
    <div className="profile-shell">
      <AppNav variant="profile" />
      <main className="profile-main">
        <ProfilePage initialData={profileData} readOnly />
      </main>
    </div>
  );
}
